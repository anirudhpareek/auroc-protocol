// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFundingEngine
/// @notice Interface for funding rate calculation and application
interface IFundingEngine {
    // ============================================
    // EVENTS
    // ============================================

    event FundingRateUpdated(bytes32 indexed marketId, int256 rate, int256 cumulative);
    event FundingApplied(bytes32 indexed positionId, int256 amount);
    event FundingParamsUpdated(bytes32 indexed marketId, uint256 maxRate, uint256 imbalanceWeight);

    // ============================================
    // ERRORS
    // ============================================

    error MarketNotFound();
    error UpdateTooFrequent();
    error Unauthorized();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current funding rate for a market
    /// @param marketId Market identifier
    /// @return Funding rate per interval (WAD, can be negative)
    function getFundingRate(bytes32 marketId) external view returns (int256);

    /// @notice Get cumulative funding for a market
    /// @param marketId Market identifier
    /// @return Cumulative funding per unit size (WAD)
    function getCumulativeFunding(bytes32 marketId) external view returns (int256);

    /// @notice Get pending funding for a position
    /// @param positionId Position ID
    /// @return Pending funding amount (positive = owes, negative = receives)
    function getPendingFunding(bytes32 positionId) external view returns (int256);

    /// @notice Get time since last funding update
    /// @param marketId Market identifier
    /// @return Seconds since last update
    function getTimeSinceUpdate(bytes32 marketId) external view returns (uint256);

    /// @notice Get funding parameters for a market
    /// @param marketId Market identifier
    /// @return maxRate Max funding rate (WAD)
    /// @return imbalanceWeight Imbalance contribution weight (WAD)
    /// @return interval Funding interval in seconds
    function getFundingParams(bytes32 marketId)
        external
        view
        returns (uint256 maxRate, uint256 imbalanceWeight, uint256 interval);

    // ============================================
    // STATE CHANGES
    // ============================================

    /// @notice Update funding for a market
    /// @param marketId Market identifier
    /// @dev Calculates new funding rate and updates cumulative
    function updateFunding(bytes32 marketId) external;

    /// @notice Update funding for all active markets
    function updateAllFunding() external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set funding parameters for a market
    /// @param marketId Market identifier
    /// @param maxRate Max funding rate per interval (WAD)
    /// @param imbalanceWeight Imbalance contribution weight (WAD)
    function setFundingParams(
        bytes32 marketId,
        uint256 maxRate,
        uint256 imbalanceWeight
    ) external;

    /// @notice Set funding interval
    /// @param interval Interval in seconds
    function setFundingInterval(uint256 interval) external;

    /// @notice Set off-hours funding clamp multiplier
    /// @param multiplier Multiplier for off-hours clamp (WAD, < 1e18 means tighter)
    function setOffHoursClampMultiplier(uint256 multiplier) external;
}
