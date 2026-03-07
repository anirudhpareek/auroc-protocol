// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title AurocCollateralTracker
/// @notice Unified ERC4626 vault for Auroc perp + options collateral.
/// @dev Replaces LiquidityBuffer as the single LP-facing vault.
///
///      Two internal allocation buckets:
///        perpAllocation    — mirrors the original LiquidityBuffer PnL settlement
///        optionsLocked     — USDC locked as option seller collateral (not withdrawable)
///
///      `totalAssets()` = total deposited USDC − optionsLocked
///      so LP share price only reflects funds actually available to LPs.
///
///      Authorized engines (PerpEngineV2 and AurocOptionsPool) call
///      `settlePnL`, `lockCollateral`, `releaseCollateral`, etc.
contract AurocCollateralTracker is ERC4626, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice USDC locked by open option-seller positions (not withdrawable by LPs)
    uint256 public optionsLocked;

    /// @notice Accumulated perp trading fees (grows the vault)
    uint256 public totalFeesAccumulated;

    /// @notice Total PnL settled historically
    int256  public totalPnLSettled;

    /// @notice Target buffer size (for compatibility with LiquidityBuffer interface)
    uint256 public targetBufferSize;

    /// @notice Authorized engines
    mapping(address => bool) public authorizedEngines;

    // ============================================
    // EVENTS
    // ============================================

    event PnLSettled(bytes32 indexed marketId, address indexed trader, int256 pnl);
    event FeesAccumulated(bytes32 indexed marketId, uint256 amount);
    event CollateralLocked(bytes32 indexed positionId, uint256 amount);
    event CollateralReleased(bytes32 indexed positionId, address indexed to, uint256 amount);
    event EngineSet(address indexed engine, bool authorized);

    // ============================================
    // ERRORS
    // ============================================

    error Unauthorized();
    error InsufficientLiquidity();
    error ZeroAmount();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /// @param _usdc      USDC token address
    /// @param _name      LP share token name  (e.g. "Auroc LP")
    /// @param _symbol    LP share token symbol (e.g. "aUSD")
    constructor(address _usdc, string memory _name, string memory _symbol)
        ERC4626(IERC20(_usdc))
        ERC20(_name, _symbol)
        Ownable(msg.sender)
    {}

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyEngine() {
        if (!authorizedEngines[msg.sender]) revert Unauthorized();
        _;
    }

    // ============================================
    // ERC4626 OVERRIDES
    // ============================================

    /// @notice Available assets = total deposited − options collateral locked
    function totalAssets() public view override returns (uint256) {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        return balance > optionsLocked ? balance - optionsLocked : 0;
    }

    // ============================================
    // PERP ENGINE INTERFACE (LiquidityBuffer-compatible)
    // ============================================

    /// @notice Settle position close — returns net amount to trader (margin ± PnL)
    /// @param marketId   Market identifier
    /// @param trader     Recipient address
    /// @param netReturn  Signed: positive = pay trader, negative = trader owes (edge)
    function settlePnL(
        bytes32 marketId,
        address trader,
        int256  netReturn
    ) external onlyEngine nonReentrant {
        totalPnLSettled += netReturn;
        if (netReturn > 0) {
            uint256 payout = uint256(netReturn);
            uint256 avail  = IERC20(asset()).balanceOf(address(this));
            if (payout > avail) revert InsufficientLiquidity();
            IERC20(asset()).safeTransfer(trader, payout);
        }
        emit PnLSettled(marketId, trader, netReturn);
    }

    /// @notice Receive margin from a trader (engine has already transferred tokens here)
    function notifyMarginReceived(uint256 /*amount*/) external onlyEngine {
        // No-op: token already in this contract, totalAssets() will see it
    }

    /// @notice Return margin directly to trader
    function returnMargin(address trader, uint256 amount) external onlyEngine nonReentrant {
        if (amount == 0) revert ZeroAmount();
        IERC20(asset()).safeTransfer(trader, amount);
    }

    /// @notice Accumulate trading fees into vault (grows LP value)
    function accumulateFees(bytes32 marketId, uint256 amount) external onlyEngine {
        totalFeesAccumulated += amount;
        emit FeesAccumulated(marketId, amount);
    }

    /// @notice Get current collateralization ratio (buffer balance / target)
    function getCollateralizationRatio() external view returns (uint256) {
        if (targetBufferSize == 0) return WAD;
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        return (balance * WAD) / targetBufferSize;
    }

    function getBalance() external view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    function getAvailableLiquidity() external view returns (uint256) {
        return totalAssets();
    }

    // ============================================
    // OPTIONS ENGINE INTERFACE
    // ============================================

    /// @notice Lock USDC as option seller collateral
    /// @dev    Called by AurocOptionsPool when a short-side leg is opened
    /// @param positionId Option position ID (for tracking/events)
    /// @param amount     USDC amount to lock (6 decimals)
    function lockCollateral(bytes32 positionId, uint256 amount) external onlyEngine {
        if (amount == 0) revert ZeroAmount();
        optionsLocked += amount;
        emit CollateralLocked(positionId, amount);
    }

    /// @notice Release locked collateral to a recipient (on option burn)
    /// @param positionId Option position ID
    /// @param to         Recipient (seller on OTM close, pool on ITM exercise)
    /// @param amount     USDC amount to release
    function releaseCollateral(
        bytes32 positionId,
        address to,
        uint256 amount
    ) external onlyEngine nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > optionsLocked) revert InsufficientLiquidity();
        optionsLocked -= amount;
        IERC20(asset()).safeTransfer(to, amount);
        emit CollateralReleased(positionId, to, amount);
    }

    /// @notice Accounting-only lock: increments optionsLocked without token transfer.
    /// @dev    Called by AurocOptionsPool when the pool itself holds the USDC.
    ///         Use when collateral has already been transferred to the pool contract.
    function notifyLock(bytes32 positionId, uint256 amount) external onlyEngine {
        if (amount == 0) revert ZeroAmount();
        optionsLocked += amount;
        emit CollateralLocked(positionId, amount);
    }

    /// @notice Accounting-only release: decrements optionsLocked without token transfer.
    /// @dev    Called by AurocOptionsPool when payout is sent directly from pool balance.
    ///         Caps at optionsLocked to avoid underflow on rounding.
    function notifyRelease(bytes32 positionId, uint256 amount) external onlyEngine {
        if (amount > optionsLocked) amount = optionsLocked;
        optionsLocked -= amount;
        emit CollateralReleased(positionId, address(0), amount);
    }

    // ============================================
    // ADMIN
    // ============================================

    function setAuthorizedEngine(address engine, bool authorized) external onlyOwner {
        authorizedEngines[engine] = authorized;
        emit EngineSet(engine, authorized);
    }

    function setTargetBufferSize(uint256 _target) external onlyOwner {
        targetBufferSize = _target;
    }

    /// @notice Emergency withdrawal of excess non-locked funds
    function withdrawExcess(uint256 amount, address to) external onlyOwner nonReentrant {
        uint256 avail = totalAssets();
        if (amount > avail) revert InsufficientLiquidity();
        IERC20(asset()).safeTransfer(to, amount);
    }
}
