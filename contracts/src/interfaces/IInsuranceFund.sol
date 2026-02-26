// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IInsuranceFund
/// @notice Interface for insurance fund that backstops liquidations
interface IInsuranceFund {
    // ============================================
    // EVENTS
    // ============================================

    event FundsDeposited(address indexed from, uint256 amount);
    event FundsWithdrawn(address indexed to, uint256 amount);
    event ShortfallCovered(bytes32 indexed positionId, uint256 amount);
    event FundsExhausted(bytes32 indexed positionId, uint256 shortfall);

    // ============================================
    // ERRORS
    // ============================================

    error InsufficientFunds();
    error ZeroAmount();
    error Unauthorized();
    error TransferFailed();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current fund balance
    /// @return Fund balance in collateral
    function getBalance() external view returns (uint256);

    /// @notice Get total amount used to cover shortfalls
    /// @return Total covered amount
    function getTotalCovered() external view returns (uint256);

    /// @notice Get number of shortfalls covered
    /// @return Count of covered shortfalls
    function getShortfallCount() external view returns (uint256);

    // ============================================
    // ACTIONS
    // ============================================

    /// @notice Cover a shortfall from liquidation
    /// @param positionId Position ID for tracking
    /// @param amount Amount to cover
    /// @return covered Amount actually covered (may be less if fund exhausted)
    function coverShortfall(bytes32 positionId, uint256 amount) external returns (uint256 covered);

    /// @notice Deposit funds into insurance fund
    /// @param amount Amount to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraw funds from insurance fund (admin only)
    /// @param amount Amount to withdraw
    /// @param to Recipient address
    function withdraw(uint256 amount, address to) external;
}
