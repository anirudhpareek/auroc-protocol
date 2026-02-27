// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IVault } from "../interfaces/IVault.sol";
import { VaultState } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title Vault
/// @notice GMX-style liquidity vault that serves as counterparty to all trades
/// @dev LPs deposit USDC and receive shares; PnL flows between traders and vault
contract Vault is IVault, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using MathLib for uint256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;
    uint256 public constant INITIAL_SHARE_PRICE = 1e18; // 1:1 initially

    // ============================================
    // STATE
    // ============================================

    /// @notice Collateral token (USDC)
    IERC20 public immutable collateral;

    /// @notice Collateral decimals for scaling
    uint8 public immutable collateralDecimals;

    /// @notice Total assets in vault (actual balance)
    uint256 public totalAssets;

    /// @notice Total shares outstanding
    uint256 public totalShares;

    /// @notice Locked collateral (used as margin for positions)
    uint256 public lockedCollateral;

    /// @notice Unrealized PnL owed to traders (can be negative = traders underwater)
    int256 public unrealizedPnL;

    /// @notice Total fees collected
    uint256 public totalFeesCollected;

    /// @notice Max utilization rate
    uint256 public maxUtilization;

    /// @notice Minimum liquidity to prevent share price manipulation
    uint256 public minLiquidity;

    /// @notice Share balances
    mapping(address => uint256) public shares;

    /// @notice Deposits paused
    bool public depositsPaused;

    /// @notice Withdrawals paused
    bool public withdrawalsPaused;

    /// @notice Authorized engines (PerpEngine, LiquidationEngine)
    mapping(address => bool) public authorizedEngines;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _collateral,
        uint8 _decimals,
        uint256 _maxUtilization,
        uint256 _minLiquidity
    ) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
        collateralDecimals = _decimals;
        maxUtilization = _maxUtilization;
        minLiquidity = _minLiquidity;
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyEngine() {
        if (!authorizedEngines[msg.sender]) revert Unauthorized();
        _;
    }

    // ============================================
    // VIEWS - IVault
    // ============================================

    /// @inheritdoc IVault
    function getSharePrice() public view override returns (uint256) {
        if (totalShares == 0) return INITIAL_SHARE_PRICE;

        // Share price = (totalAssets - unrealizedPnL) / totalShares
        // unrealizedPnL is what traders would get if closed now (in WAD)
        // If unrealizedPnL > 0, vault owes traders => lower share price
        // If unrealizedPnL < 0, traders owe vault => higher share price

        // Scale totalAssets to WAD first
        int256 scaledAssets = int256(_scaleToWad(totalAssets));
        int256 netAssets = scaledAssets - unrealizedPnL;
        if (netAssets <= 0) return 0; // Vault is insolvent

        // Both netAssets and totalShares are in WAD scale
        return (uint256(netAssets) * WAD) / totalShares;
    }

    /// @inheritdoc IVault
    function getTotalAssets() external view override returns (uint256) {
        return totalAssets;
    }

    /// @inheritdoc IVault
    function getTotalShares() external view override returns (uint256) {
        return totalShares;
    }

    /// @inheritdoc IVault
    function getTotalDebt() external view override returns (int256) {
        return unrealizedPnL;
    }

    /// @inheritdoc IVault
    function getUtilization() public view override returns (uint256) {
        if (totalAssets == 0) return 0;
        return (lockedCollateral * WAD) / totalAssets;
    }

    /// @inheritdoc IVault
    function getAvailableLiquidity() public view override returns (uint256) {
        if (totalAssets <= lockedCollateral) return 0;
        uint256 available = totalAssets - lockedCollateral;

        // Apply max utilization cap
        uint256 maxLocked = totalAssets.mulWad(maxUtilization);
        if (lockedCollateral >= maxLocked) return 0;

        uint256 remainingCapacity = maxLocked - lockedCollateral;
        return available < remainingCapacity ? available : remainingCapacity;
    }

    /// @inheritdoc IVault
    function getState() external view override returns (VaultState memory) {
        return VaultState({
            totalAssets: totalAssets,
            totalShares: totalShares,
            totalDebt: lockedCollateral,
            utilizationRate: getUtilization(),
            lastUpdateTime: block.timestamp
        });
    }

    /// @inheritdoc IVault
    function previewDeposit(uint256 amount) public view override returns (uint256) {
        if (totalShares == 0) {
            // First deposit: shares = scaled amount (WAD scale)
            return _scaleToWad(amount);
        }
        uint256 sharePrice = getSharePrice();
        if (sharePrice == 0) return 0;

        // Scale amount to WAD if needed
        uint256 scaledAmount = _scaleToWad(amount);
        return (scaledAmount * WAD) / sharePrice;
    }

    /// @inheritdoc IVault
    function previewWithdraw(uint256 _shares) public view override returns (uint256) {
        if (totalShares == 0 || _shares == 0) return 0;

        uint256 sharePrice = getSharePrice();
        // rawAmount is in WAD (shares are in WAD, sharePrice is WAD)
        uint256 rawAmount = (_shares * sharePrice) / WAD;

        // Scale back to collateral decimals (e.g., from 18 to 6 decimals)
        return _scaleFromWad(rawAmount);
    }

    /// @inheritdoc IVault
    function balanceOf(address user) external view override returns (uint256) {
        return shares[user];
    }

    // ============================================
    // USER ACTIONS - IVault
    // ============================================

    /// @inheritdoc IVault
    function deposit(uint256 amount) external override nonReentrant whenNotPaused returns (uint256) {
        if (depositsPaused) revert DepositsPaused();
        if (amount == 0) revert ZeroAmount();

        uint256 sharesToMint = previewDeposit(amount);
        if (sharesToMint == 0) revert ZeroShares();

        // Transfer collateral
        collateral.safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        totalAssets += amount;
        totalShares += sharesToMint;
        shares[msg.sender] += sharesToMint;

        emit Deposit(msg.sender, amount, sharesToMint);

        return sharesToMint;
    }

    /// @inheritdoc IVault
    function withdraw(uint256 _shares) external override nonReentrant returns (uint256) {
        if (withdrawalsPaused) revert WithdrawalsPaused();
        if (_shares == 0) revert ZeroShares();
        if (shares[msg.sender] < _shares) revert InsufficientBalance();

        uint256 amountToReturn = previewWithdraw(_shares);
        if (amountToReturn == 0) revert ZeroAmount();

        // Check liquidity
        uint256 available = totalAssets > lockedCollateral ? totalAssets - lockedCollateral : 0;

        // Cap amountToReturn to available (handles rounding edge cases)
        if (amountToReturn > available) {
            amountToReturn = available;
        }

        // Ensure minimum liquidity remains (only if not withdrawing all)
        if (totalAssets - amountToReturn < minLiquidity && totalShares - _shares > 0) {
            revert InsufficientLiquidity();
        }

        // Update state
        shares[msg.sender] -= _shares;
        totalShares -= _shares;
        totalAssets -= amountToReturn;

        // Transfer collateral
        collateral.safeTransfer(msg.sender, amountToReturn);

        emit Withdraw(msg.sender, _shares, amountToReturn);

        return amountToReturn;
    }

    // ============================================
    // PERP ENGINE INTERFACE - IVault
    // ============================================

    /// @inheritdoc IVault
    function lockCollateral(uint256 amount) external override onlyEngine {
        if (amount > getAvailableLiquidity()) revert InsufficientLiquidity();
        lockedCollateral += amount;
        emit UtilizationUpdated(getUtilization());
    }

    /// @inheritdoc IVault
    function unlockCollateral(uint256 amount) external override onlyEngine {
        if (amount > lockedCollateral) {
            lockedCollateral = 0;
        } else {
            lockedCollateral -= amount;
        }
        emit UtilizationUpdated(getUtilization());
    }

    /// @inheritdoc IVault
    function settlePnL(bytes32 marketId, address trader, int256 pnl) external override onlyEngine {
        // pnl > 0: trader profit => vault pays => reduce totalAssets
        // pnl < 0: trader loss => vault gains => increase totalAssets

        if (pnl > 0) {
            uint256 profit = uint256(pnl);
            uint256 scaledProfit = _scaleFromWad(profit);
            if (scaledProfit > totalAssets) {
                // Vault cannot pay full amount - this should trigger insurance
                revert InsufficientLiquidity();
            }
            totalAssets -= scaledProfit;
            collateral.safeTransfer(trader, scaledProfit);
        } else if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            uint256 scaledLoss = _scaleFromWad(loss);
            // Loss already in vault via margin, just track it
            totalAssets += scaledLoss;
        }

        // Update unrealized PnL tracking
        unrealizedPnL -= pnl; // Realized now, remove from unrealized

        emit PnLSettled(marketId, pnl, trader);
    }

    /// @notice Settle a closed position - returns margin +/- PnL to trader
    /// @param marketId Market identifier
    /// @param trader Trader address
    /// @param margin Original margin amount (in collateral decimals)
    /// @param pnlWad PnL in WAD (can be negative)
    /// @param feeWad Fee in WAD
    function settlePosition(
        bytes32 marketId,
        address trader,
        uint256 margin,
        int256 pnlWad,
        uint256 feeWad
    ) external onlyEngine {
        // Scale PnL and fee from WAD to collateral decimals
        int256 pnlScaled = pnlWad / int256(1e12);
        uint256 feeScaled = feeWad / 1e12;

        // Net return to trader: margin + pnl - fee
        int256 netReturn = int256(margin) + pnlScaled - int256(feeScaled);

        if (netReturn > 0) {
            // Trader gets some amount back
            uint256 returnAmount = uint256(netReturn);

            // Check vault has enough
            if (returnAmount > totalAssets) {
                revert InsufficientLiquidity();
            }

            // If net return < margin, LPs gained the difference
            // If net return > margin, LPs lost the difference
            if (netReturn > int256(margin)) {
                // Profit: LPs pay (netReturn - margin) = (pnl - fee)
                totalAssets -= (returnAmount - margin);
            } else {
                // Loss: LPs gain (margin - netReturn) = -(pnl - fee) = (loss + fee)
                totalAssets += (margin - returnAmount);
            }

            collateral.safeTransfer(trader, returnAmount);
        } else {
            // Complete loss - trader gets nothing, LPs gain full margin
            totalAssets += margin;
        }

        // Update unrealized PnL tracking (net of fee)
        unrealizedPnL -= (pnlWad - int256(feeWad));

        emit PnLSettled(marketId, pnlWad - int256(feeWad), trader);
    }

    /// @inheritdoc IVault
    function collectFees(bytes32 marketId, uint256 amount) external override onlyEngine {
        totalFeesCollected += amount;
        // Fees are already in the vault via margin payments
        emit FeesCollected(marketId, amount);
    }

    /// @notice Update unrealized PnL (called by PerpEngine on position updates)
    /// @param delta Change in unrealized PnL
    function updateUnrealizedPnL(int256 delta) external onlyEngine {
        unrealizedPnL += delta;
    }

    // ============================================
    // INSURANCE INTERFACE - IVault
    // ============================================

    /// @inheritdoc IVault
    function coverShortfall(uint256 amount) external override onlyEngine {
        // Funds should already be transferred to vault, just update accounting
        // Verify the balance is sufficient
        require(collateral.balanceOf(address(this)) >= totalAssets + amount, "INSUFFICIENT_BALANCE");
        totalAssets += amount;
    }

    /// @inheritdoc IVault
    function socializeLoss(uint256 amount) external override onlyEngine {
        // Last resort: reduce totalAssets, LPs take the hit
        if (amount > totalAssets) {
            totalAssets = 0;
        } else {
            totalAssets -= amount;
        }
    }

    // ============================================
    // CONFIG - IVault
    // ============================================

    /// @inheritdoc IVault
    function setMaxUtilization(uint256 maxUtil) external override onlyOwner {
        require(maxUtil <= WAD, "INVALID_UTIL");
        maxUtilization = maxUtil;
    }

    /// @inheritdoc IVault
    function setDepositsPaused(bool paused) external override onlyOwner {
        depositsPaused = paused;
    }

    /// @inheritdoc IVault
    function setWithdrawalsPaused(bool paused) external override onlyOwner {
        withdrawalsPaused = paused;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Authorize an engine
    /// @param engine Engine address
    /// @param authorized Authorization status
    function setAuthorizedEngine(address engine, bool authorized) external onlyOwner {
        authorizedEngines[engine] = authorized;
    }

    /// @notice Set minimum liquidity
    /// @param _minLiquidity New minimum
    function setMinLiquidity(uint256 _minLiquidity) external onlyOwner {
        minLiquidity = _minLiquidity;
    }

    /// @notice Emergency pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Scale collateral amount to WAD (18 decimals)
    function _scaleToWad(uint256 amount) internal view returns (uint256) {
        if (collateralDecimals == 18) return amount;
        if (collateralDecimals < 18) {
            return amount * (10 ** (18 - collateralDecimals));
        }
        return amount / (10 ** (collateralDecimals - 18));
    }

    /// @dev Scale WAD amount to collateral decimals
    function _scaleFromWad(uint256 amount) internal view returns (uint256) {
        if (collateralDecimals == 18) return amount;
        if (collateralDecimals < 18) {
            return amount / (10 ** (18 - collateralDecimals));
        }
        return amount * (10 ** (collateralDecimals - 18));
    }
}
