// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MathLib } from "../libraries/MathLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidityBuffer
/// @notice First-loss capital layer that absorbs trader PnL before the LP Vault
/// @dev Inspired by Ostium's two-tier liquidity architecture
///
/// The Buffer:
/// - Takes first-loss on trader profits (protects LPs)
/// - Accumulates trader losses (grows from trading activity)
/// - Is funded by protocol fees, not LP deposits
/// - Only when depleted does the Vault step in
contract LiquidityBuffer is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using MathLib for uint256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice Collateral token (USDC)
    IERC20 public immutable collateral;

    /// @notice Collateral decimals (for scaling to WAD when calling Vault)
    uint8 public immutable collateralDecimals;

    /// @notice Current buffer balance (in collateral decimals)
    uint256 public bufferBalance;

    /// @notice Target buffer size (for collateralization ratio)
    uint256 public targetBufferSize;

    /// @notice Total PnL settled through buffer (for stats)
    int256 public totalPnLSettled;

    /// @notice Total fees accumulated
    uint256 public totalFeesAccumulated;

    /// @notice Authorized engines (PerpEngine)
    mapping(address => bool) public authorizedEngines;

    /// @notice Address of the Vault (fallback when buffer depleted)
    address public vault;

    // ============================================
    // EVENTS
    // ============================================

    event BufferDeposit(address indexed from, uint256 amount);
    event BufferWithdraw(address indexed to, uint256 amount);
    event PnLSettled(bytes32 indexed marketId, address indexed trader, int256 pnl, bool usedVault);
    event FeesAccumulated(bytes32 indexed marketId, uint256 amount);
    event CollateralizationChanged(uint256 ratio);

    // ============================================
    // ERRORS
    // ============================================

    error Unauthorized();
    error InsufficientBuffer();
    error ZeroAmount();
    error VaultNotSet();
    error TransferFailed();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _collateral, uint256 _targetBufferSize, uint8 _decimals) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
        targetBufferSize = _targetBufferSize;
        collateralDecimals = _decimals;
    }

    /// @dev Scale collateral amount to WAD (18 decimals)
    function _scaleToWad(uint256 amount) internal view returns (uint256) {
        if (collateralDecimals == 18) return amount;
        if (collateralDecimals < 18) {
            return amount * (10 ** (18 - collateralDecimals));
        }
        return amount / (10 ** (collateralDecimals - 18));
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyEngine() {
        if (!authorizedEngines[msg.sender]) revert Unauthorized();
        _;
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current collateralization ratio
    /// @return ratio Ratio in WAD (1e18 = 100%)
    function getCollateralizationRatio() public view returns (uint256) {
        if (targetBufferSize == 0) return WAD;
        return (bufferBalance * WAD) / targetBufferSize;
    }

    /// @notice Check if buffer is overcollateralized (>= 100%)
    /// @return True if ratio >= 100%
    function isOvercollateralized() public view returns (bool) {
        return bufferBalance >= targetBufferSize;
    }

    /// @notice Get buffer balance
    function getBalance() external view returns (uint256) {
        return bufferBalance;
    }

    /// @notice Get available liquidity in buffer
    function getAvailableLiquidity() external view returns (uint256) {
        return bufferBalance;
    }

    // ============================================
    // SETTLEMENT - Called by PerpEngine
    // ============================================

    /// @notice Settle position close - returns margin +/- PnL to trader
    /// @param marketId Market identifier
    /// @param trader Trader address
    /// @param returnAmount Total amount to return (margin + pnl - fees + rebate)
    /// @return usedVault True if vault was needed (buffer insufficient)
    function settlePnL(
        bytes32 marketId,
        address trader,
        int256 returnAmount
    ) external onlyEngine nonReentrant returns (bool usedVault) {
        totalPnLSettled += returnAmount;

        if (returnAmount > 0) {
            // Trader gets money back (margin + profit OR margin - partial loss)
            uint256 payout = uint256(returnAmount);

            if (payout <= bufferBalance) {
                // Buffer can cover it
                bufferBalance -= payout;
                collateral.safeTransfer(trader, payout);
                usedVault = false;
            } else {
                // Buffer insufficient - use what we have, vault covers rest
                if (vault == address(0)) revert VaultNotSet();

                uint256 fromBuffer = bufferBalance;
                uint256 fromVault = payout - fromBuffer;

                if (fromBuffer > 0) {
                    bufferBalance = 0;
                    collateral.safeTransfer(trader, fromBuffer);
                }

                // Call vault to cover remainder (scale to WAD for Vault)
                IVaultSettlement(vault).settlePnL(marketId, trader, int256(_scaleToWad(fromVault)));
                usedVault = true;
            }
        } else if (returnAmount < 0) {
            // Trader owes money (loss exceeded margin - should be liquidated)
            // This case shouldn't happen in normal operation
            // The negative amount stays in buffer as profit for LPs
            usedVault = false;
        }
        // If returnAmount == 0, nothing to transfer (rare edge case)

        emit PnLSettled(marketId, trader, returnAmount, usedVault);
        emit CollateralizationChanged(getCollateralizationRatio());

        return usedVault;
    }

    /// @notice Receive margin from trader (called when position opens)
    /// @param amount Margin amount
    function receiveMargin(uint256 amount) external onlyEngine {
        // Margin is transferred to buffer, will be used for settlement
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        bufferBalance += amount;
    }

    /// @notice Return margin to trader (called when position closes with no loss)
    /// @param trader Trader address
    /// @param amount Margin amount
    function returnMargin(address trader, uint256 amount) external onlyEngine {
        if (amount > bufferBalance) revert InsufficientBuffer();
        bufferBalance -= amount;
        collateral.safeTransfer(trader, amount);
    }

    /// @notice Notify buffer of margin received directly from trader
    /// @dev Called by PerpEngine after transferring tokens directly to buffer
    /// @param amount Margin amount that was sent
    function notifyMarginReceived(uint256 amount) external onlyEngine {
        bufferBalance += amount;
    }

    /// @notice Accumulate trading fees into buffer
    /// @param marketId Market identifier
    /// @param amount Fee amount
    function accumulateFees(bytes32 marketId, uint256 amount) external onlyEngine {
        // Fees grow the buffer
        bufferBalance += amount;
        totalFeesAccumulated += amount;
        emit FeesAccumulated(marketId, amount);
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Deposit funds into buffer (protocol funded)
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        collateral.safeTransferFrom(msg.sender, address(this), amount);
        bufferBalance += amount;
        emit BufferDeposit(msg.sender, amount);
    }

    /// @notice Withdraw excess funds from buffer
    /// @param amount Amount to withdraw
    /// @param to Recipient
    function withdraw(uint256 amount, address to) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        // Only allow withdrawal if overcollateralized after
        if (bufferBalance - amount < targetBufferSize) revert InsufficientBuffer();
        bufferBalance -= amount;
        collateral.safeTransfer(to, amount);
        emit BufferWithdraw(to, amount);
    }

    /// @notice Set target buffer size
    /// @param _targetBufferSize New target
    function setTargetBufferSize(uint256 _targetBufferSize) external onlyOwner {
        targetBufferSize = _targetBufferSize;
    }

    /// @notice Set vault address
    /// @param _vault Vault address
    function setVault(address _vault) external onlyOwner {
        vault = _vault;
    }

    /// @notice Authorize an engine
    /// @param engine Engine address
    /// @param authorized Authorization status
    function setAuthorizedEngine(address engine, bool authorized) external onlyOwner {
        authorizedEngines[engine] = authorized;
    }
}

/// @notice Minimal interface for vault settlement
interface IVaultSettlement {
    function settlePnL(bytes32 marketId, address trader, int256 pnl) external;
}
