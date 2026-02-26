// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Regime, MarketState, TransitionState } from "../types/DataTypes.sol";

/// @title IIndexEngine
/// @notice Interface for regime management and mark price computation
interface IIndexEngine {
    // ============================================
    // EVENTS
    // ============================================

    event RegimeChanged(bytes32 indexed marketId, Regime from, Regime to, uint256 timestamp);
    event TransitionStarted(bytes32 indexed marketId, uint256 duration, uint256 gapPercent);
    event TransitionCompleted(bytes32 indexed marketId);
    event ConfidenceUpdated(bytes32 indexed marketId, uint256 confidence);
    event MarkPriceUpdated(bytes32 indexed marketId, uint256 markPrice, uint256 indexPrice);
    event StressModeActivated(bytes32 indexed marketId, string reason);

    // ============================================
    // ERRORS
    // ============================================

    error InvalidRegimeTransition();
    error MarketNotFound();
    error TransitionAlreadyActive();
    error NotInTransition();
    error UnauthorizedCaller();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current index price for a market
    /// @param marketId Market identifier
    /// @return Index price in WAD
    function getIndexPrice(bytes32 marketId) external view returns (uint256);

    /// @notice Get current mark price for a market
    /// @param marketId Market identifier
    /// @return Mark price in WAD
    function getMarkPrice(bytes32 marketId) external view returns (uint256);

    /// @notice Get current regime for a market
    /// @param marketId Market identifier
    /// @return Current regime
    function getRegime(bytes32 marketId) external view returns (Regime);

    /// @notice Get current confidence for a market
    /// @param marketId Market identifier
    /// @return Confidence in WAD [0, 1e18]
    function getConfidence(bytes32 marketId) external view returns (uint256);

    /// @notice Get full market state
    /// @param marketId Market identifier
    /// @return MarketState struct
    function getMarketState(bytes32 marketId) external view returns (MarketState memory);

    /// @notice Get transition state
    /// @param marketId Market identifier
    /// @return TransitionState struct
    function getTransitionState(bytes32 marketId) external view returns (TransitionState memory);

    /// @notice Check if trading is allowed (not in STRESS close-only)
    /// @param marketId Market identifier
    /// @param isIncrease True if opening/increasing position
    /// @return True if trade is allowed
    function canTrade(bytes32 marketId, bool isIncrease) external view returns (bool);

    // ============================================
    // STATE CHANGES
    // ============================================

    /// @notice Update prices and regime (called by keepers or internally)
    /// @param marketId Market identifier
    function updateMarket(bytes32 marketId) external;

    /// @notice Force regime change (admin only)
    /// @param marketId Market identifier
    /// @param newRegime New regime to set
    function setRegime(bytes32 marketId, Regime newRegime) external;

    /// @notice Start transition period (triggered at market reopen)
    /// @param marketId Market identifier
    /// @param duration Transition duration in seconds
    function startTransition(bytes32 marketId, uint256 duration) external;

    /// @notice Activate STRESS mode
    /// @param marketId Market identifier
    /// @param reason Reason for stress activation
    function activateStress(bytes32 marketId, string calldata reason) external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set mark price clamp parameters
    /// @param d0 Base clamp (WAD)
    /// @param d1 Confidence-scaled clamp (WAD)
    function setClampParams(uint256 d0, uint256 d1) external;

    /// @notice Set confidence threshold for STRESS mode
    /// @param threshold Confidence below which STRESS activates (WAD)
    function setStressThreshold(uint256 threshold) external;

    /// @notice Set default transition duration
    /// @param duration Duration in seconds
    function setDefaultTransitionDuration(uint256 duration) external;
}
