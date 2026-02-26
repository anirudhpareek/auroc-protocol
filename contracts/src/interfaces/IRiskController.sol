// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { RiskParams } from "../types/DataTypes.sol";

/// @title IRiskController
/// @notice Interface for dynamic risk parameter management
interface IRiskController {
    // ============================================
    // EVENTS
    // ============================================

    event RiskParamsUpdated(bytes32 indexed marketId, RiskParams params);
    event CloseOnlyActivated(bytes32 indexed marketId);
    event CloseOnlyDeactivated(bytes32 indexed marketId);
    event BaseParamsUpdated(bytes32 indexed marketId);

    // ============================================
    // ERRORS
    // ============================================

    error InvalidParams();
    error MarketNotFound();
    error Unauthorized();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current risk parameters for a market
    /// @param marketId Market identifier
    /// @return RiskParams struct with effective values
    function getRiskParams(bytes32 marketId) external view returns (RiskParams memory);

    /// @notice Get effective max leverage based on confidence
    /// @param marketId Market identifier
    /// @param confidence Current confidence [0, 1e18]
    /// @return Max leverage in WAD
    function getEffectiveLeverage(bytes32 marketId, uint256 confidence) external view returns (uint256);

    /// @notice Get effective spread based on market conditions
    /// @param marketId Market identifier
    /// @param confidence Current confidence [0, 1e18]
    /// @param utilization Vault utilization [0, 1e18]
    /// @param volatility Recent volatility estimate (WAD)
    /// @return Spread in WAD
    function getEffectiveSpread(
        bytes32 marketId,
        uint256 confidence,
        uint256 utilization,
        uint256 volatility
    ) external view returns (uint256);

    /// @notice Get effective OI cap based on confidence
    /// @param marketId Market identifier
    /// @param confidence Current confidence [0, 1e18]
    /// @return OI cap in USD (WAD)
    function getEffectiveOICap(bytes32 marketId, uint256 confidence) external view returns (uint256);

    /// @notice Calculate impact for a trade
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive or negative)
    /// @param currentOI Current open interest
    /// @return Impact in WAD (as price multiplier)
    function calculateImpact(
        bytes32 marketId,
        int256 sizeDelta,
        int256 currentOI
    ) external view returns (uint256);

    /// @notice Check if trade is within risk bounds
    /// @param marketId Market identifier
    /// @param sizeDelta Size change
    /// @param margin Margin amount
    /// @param isIncrease True if increasing exposure
    /// @return allowed True if trade is allowed
    /// @return reason Rejection reason if not allowed
    function validateTrade(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 margin,
        bool isIncrease
    ) external view returns (bool allowed, string memory reason);

    // ============================================
    // STATE CHANGES
    // ============================================

    /// @notice Update risk params based on current market state
    /// @param marketId Market identifier
    function updateRiskParams(bytes32 marketId) external;

    /// @notice Update current OI for a market
    /// @param marketId Market identifier
    /// @param oi Current open interest
    function updateOI(bytes32 marketId, int256 oi) external;

    /// @notice Set close-only mode
    /// @param marketId Market identifier
    /// @param closeOnly True to enable close-only
    function setCloseOnly(bytes32 marketId, bool closeOnly) external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set base risk parameters for a market
    /// @param marketId Market identifier
    /// @param maxLeverage Base max leverage (WAD)
    /// @param maxOI Base max OI (USD WAD)
    /// @param spreadBase Base spread (WAD)
    /// @param spreadConfidence Confidence component (WAD)
    /// @param spreadVol Volatility component (WAD)
    /// @param spreadUtil Utilization component (WAD)
    function setBaseParams(
        bytes32 marketId,
        uint256 maxLeverage,
        uint256 maxOI,
        uint256 spreadBase,
        uint256 spreadConfidence,
        uint256 spreadVol,
        uint256 spreadUtil
    ) external;

    /// @notice Set impact coefficient
    /// @param marketId Market identifier
    /// @param kImpact Impact coefficient (WAD)
    function setImpactCoefficient(bytes32 marketId, uint256 kImpact) external;

    /// @notice Set confidence threshold for STRESS
    /// @param threshold Confidence below which STRESS triggers (WAD)
    function setStressThreshold(uint256 threshold) external;
}
