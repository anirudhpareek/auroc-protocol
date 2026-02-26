// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { VaultState } from "../types/DataTypes.sol";

/// @title IVault
/// @notice Interface for GMX-style liquidity vault
interface IVault {
    // ============================================
    // EVENTS
    // ============================================

    event Deposit(address indexed user, uint256 amount, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 amount);
    event PnLSettled(bytes32 indexed marketId, int256 pnl, address indexed trader);
    event FeesCollected(bytes32 indexed marketId, uint256 amount);
    event UtilizationUpdated(uint256 utilization);

    // ============================================
    // ERRORS
    // ============================================

    error InsufficientBalance();
    error InsufficientLiquidity();
    error UtilizationTooHigh();
    error ZeroAmount();
    error ZeroShares();
    error TransferFailed();
    error Unauthorized();
    error DepositsPaused();
    error WithdrawalsPaused();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current share price
    /// @return Share price in WAD (1 share = X collateral)
    function getSharePrice() external view returns (uint256);

    /// @notice Get total assets under management
    /// @return Total collateral in vault
    function getTotalAssets() external view returns (uint256);

    /// @notice Get total shares outstanding
    /// @return Total LP shares
    function getTotalShares() external view returns (uint256);

    /// @notice Get total unrealized debt to traders
    /// @return Total unrealized PnL owed
    function getTotalDebt() external view returns (int256);

    /// @notice Get current utilization rate
    /// @return Utilization in WAD [0, 1e18]
    function getUtilization() external view returns (uint256);

    /// @notice Get available liquidity for new positions
    /// @return Available collateral
    function getAvailableLiquidity() external view returns (uint256);

    /// @notice Get vault state
    /// @return VaultState struct
    function getState() external view returns (VaultState memory);

    /// @notice Preview shares for deposit amount
    /// @param amount Collateral amount
    /// @return shares Shares to mint
    function previewDeposit(uint256 amount) external view returns (uint256 shares);

    /// @notice Preview collateral for share redemption
    /// @param shares Shares to burn
    /// @return amount Collateral to receive
    function previewWithdraw(uint256 shares) external view returns (uint256 amount);

    /// @notice Get user's share balance
    /// @param user User address
    /// @return Share balance
    function balanceOf(address user) external view returns (uint256);

    // ============================================
    // USER ACTIONS
    // ============================================

    /// @notice Deposit collateral and receive LP shares
    /// @param amount Collateral amount to deposit
    /// @return shares Shares minted
    function deposit(uint256 amount) external returns (uint256 shares);

    /// @notice Withdraw collateral by burning LP shares
    /// @param shares Shares to burn
    /// @return amount Collateral received
    function withdraw(uint256 shares) external returns (uint256 amount);

    // ============================================
    // PERP ENGINE INTERFACE
    // ============================================

    /// @notice Lock collateral for a new position (called by PerpEngine)
    /// @param amount Collateral to lock
    function lockCollateral(uint256 amount) external;

    /// @notice Unlock collateral when position closes (called by PerpEngine)
    /// @param amount Collateral to unlock
    function unlockCollateral(uint256 amount) external;

    /// @notice Settle PnL when position closes (called by PerpEngine)
    /// @param marketId Market identifier
    /// @param trader Trader address
    /// @param pnl PnL amount (positive = trader profit, negative = trader loss)
    function settlePnL(bytes32 marketId, address trader, int256 pnl) external;

    /// @notice Collect trading fees (called by PerpEngine)
    /// @param marketId Market identifier
    /// @param amount Fee amount
    function collectFees(bytes32 marketId, uint256 amount) external;

    // ============================================
    // INSURANCE INTERFACE
    // ============================================

    /// @notice Cover shortfall from InsuranceFund (called by LiquidationEngine)
    /// @param amount Shortfall amount
    function coverShortfall(uint256 amount) external;

    /// @notice Socialize losses to LPs (last resort)
    /// @param amount Loss amount
    function socializeLoss(uint256 amount) external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set max utilization rate
    /// @param maxUtil Max utilization in WAD
    function setMaxUtilization(uint256 maxUtil) external;

    /// @notice Pause deposits
    /// @param paused True to pause
    function setDepositsPaused(bool paused) external;

    /// @notice Pause withdrawals
    /// @param paused True to pause
    function setWithdrawalsPaused(bool paused) external;
}
