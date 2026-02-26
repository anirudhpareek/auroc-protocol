// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IRiskController } from "../interfaces/IRiskController.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { RiskParams, Regime } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title RiskController
/// @notice Manages dynamic risk parameters based on confidence, utilization, and volatility
contract RiskController is IRiskController, Ownable2Step {
    using MathLib for uint256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice Index engine for regime and confidence
    IIndexEngine public indexEngine;

    /// @notice Stress confidence threshold
    uint256 public stressThreshold;

    /// @notice Base risk parameters per market
    struct BaseRiskParams {
        uint256 maxLeverage;    // L0 - base max leverage (WAD)
        uint256 maxOI;          // Base max OI (USD WAD)
        uint256 spreadBase;     // s0 - base spread (WAD)
        uint256 spreadConf;     // s1 - confidence component (WAD)
        uint256 spreadVol;      // s2 - volatility component (WAD)
        uint256 spreadUtil;     // s3 - utilization component (WAD)
        uint256 impactCoeff;    // k_impact - impact coefficient (WAD)
        bool isConfigured;
    }

    mapping(bytes32 => BaseRiskParams) public baseParams;

    /// @notice Close-only status per market
    mapping(bytes32 => bool) public closeOnlyMarkets;

    /// @notice Current cached risk params per market
    mapping(bytes32 => RiskParams) public cachedRiskParams;

    /// @notice Vault utilization (set by PerpEngine)
    uint256 public vaultUtilization;

    /// @notice Estimated volatility per market
    mapping(bytes32 => uint256) public marketVolatility;

    /// @notice Current OI per market
    mapping(bytes32 => int256) public currentOI;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _indexEngine, uint256 _stressThreshold) Ownable(msg.sender) {
        indexEngine = IIndexEngine(_indexEngine);
        stressThreshold = _stressThreshold;
    }

    // ============================================
    // VIEWS - IRiskController
    // ============================================

    /// @inheritdoc IRiskController
    function getRiskParams(bytes32 marketId) external view override returns (RiskParams memory) {
        return _computeRiskParams(marketId);
    }

    /// @inheritdoc IRiskController
    function getEffectiveLeverage(
        bytes32 marketId,
        uint256 confidence
    ) external view override returns (uint256) {
        BaseRiskParams storage base = baseParams[marketId];
        if (!base.isConfigured) return WAD; // 1x default

        // maxLev = clamp(L0 * C, 1, L0)
        uint256 scaledLev = base.maxLeverage.mulWad(confidence);
        return MathLib.clamp(scaledLev, WAD, base.maxLeverage);
    }

    /// @inheritdoc IRiskController
    function getEffectiveSpread(
        bytes32 marketId,
        uint256 confidence,
        uint256 utilization,
        uint256 volatility
    ) external view override returns (uint256) {
        return _computeSpread(marketId, confidence, utilization, volatility);
    }

    /// @inheritdoc IRiskController
    function getEffectiveOICap(
        bytes32 marketId,
        uint256 confidence
    ) external view override returns (uint256) {
        BaseRiskParams storage base = baseParams[marketId];
        if (!base.isConfigured) return 0;

        // OI cap scales with C and available capacity
        // cap = maxOI * C * (1 - |currentOI|/maxOI)
        int256 oi = currentOI[marketId];
        uint256 absOI = MathLib.abs(oi);

        if (absOI >= base.maxOI) return 0;

        uint256 capacityFactor = WAD - (absOI * WAD / base.maxOI);
        uint256 effectiveCap = base.maxOI.mulWad(confidence).mulWad(capacityFactor);

        return effectiveCap;
    }

    /// @inheritdoc IRiskController
    function calculateImpact(
        bytes32 marketId,
        int256 sizeDelta,
        int256 oi
    ) external view override returns (uint256) {
        BaseRiskParams storage base = baseParams[marketId];
        if (!base.isConfigured) return 0;

        // impact = k_impact * (|OI + sizeDelta/2|) / cap_OI
        int256 avgOI = oi + sizeDelta / 2;
        uint256 absAvgOI = MathLib.abs(avgOI);

        if (base.maxOI == 0) return 0;

        uint256 impact = base.impactCoeff.mulWad(absAvgOI * WAD / base.maxOI);

        return impact;
    }

    /// @inheritdoc IRiskController
    function validateTrade(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 margin,
        bool isIncrease
    ) external view override returns (bool allowed, string memory reason) {
        // Check close-only
        if (closeOnlyMarkets[marketId] && isIncrease) {
            return (false, "Market is close-only");
        }

        // Check regime
        Regime regime = indexEngine.getRegime(marketId);
        if (regime == Regime.STRESS && isIncrease) {
            return (false, "STRESS mode - close only");
        }

        // Check index engine restrictions
        if (!indexEngine.canTrade(marketId, isIncrease)) {
            return (false, "Trade restricted by regime");
        }

        // Get effective params
        RiskParams memory params = _computeRiskParams(marketId);

        // Check leverage
        if (margin > 0 && isIncrease) {
            uint256 notional = MathLib.abs(sizeDelta);
            uint256 leverage = notional * WAD / margin;
            if (leverage > params.effectiveLeverage) {
                return (false, "Exceeds max leverage");
            }
        }

        // Check OI cap
        if (isIncrease) {
            int256 newOI = currentOI[marketId] + sizeDelta;
            uint256 absNewOI = MathLib.abs(newOI);
            BaseRiskParams storage base = baseParams[marketId];
            if (absNewOI > params.effectiveOICap && absNewOI > MathLib.abs(currentOI[marketId])) {
                return (false, "Exceeds OI cap");
            }
        }

        return (true, "");
    }

    // ============================================
    // STATE CHANGES - IRiskController
    // ============================================

    /// @inheritdoc IRiskController
    function updateRiskParams(bytes32 marketId) external override {
        RiskParams memory params = _computeRiskParams(marketId);
        cachedRiskParams[marketId] = params;

        // Check for auto close-only trigger
        uint256 confidence = indexEngine.getConfidence(marketId);
        if (confidence < stressThreshold && !closeOnlyMarkets[marketId]) {
            closeOnlyMarkets[marketId] = true;
            emit CloseOnlyActivated(marketId);
        }

        emit RiskParamsUpdated(marketId, params);
    }

    /// @inheritdoc IRiskController
    function setCloseOnly(bytes32 marketId, bool closeOnly) external override onlyOwner {
        closeOnlyMarkets[marketId] = closeOnly;
        if (closeOnly) {
            emit CloseOnlyActivated(marketId);
        } else {
            emit CloseOnlyDeactivated(marketId);
        }
    }

    // ============================================
    // CONFIG - IRiskController
    // ============================================

    /// @inheritdoc IRiskController
    function setBaseParams(
        bytes32 marketId,
        uint256 maxLeverage,
        uint256 maxOI,
        uint256 spreadBase,
        uint256 spreadConfidence,
        uint256 spreadVol,
        uint256 spreadUtil
    ) external override onlyOwner {
        baseParams[marketId] = BaseRiskParams({
            maxLeverage: maxLeverage,
            maxOI: maxOI,
            spreadBase: spreadBase,
            spreadConf: spreadConfidence,
            spreadVol: spreadVol,
            spreadUtil: spreadUtil,
            impactCoeff: baseParams[marketId].impactCoeff, // Preserve
            isConfigured: true
        });

        emit BaseParamsUpdated(marketId);
    }

    /// @inheritdoc IRiskController
    function setImpactCoefficient(bytes32 marketId, uint256 kImpact) external override onlyOwner {
        baseParams[marketId].impactCoeff = kImpact;
    }

    /// @inheritdoc IRiskController
    function setStressThreshold(uint256 threshold) external override onlyOwner {
        stressThreshold = threshold;
    }

    // ============================================
    // EXTERNAL STATE SETTERS (called by other engines)
    // ============================================

    /// @notice Update vault utilization (called by Vault/PerpEngine)
    /// @param utilization Current utilization [0, 1e18]
    function updateUtilization(uint256 utilization) external {
        // TODO: Add access control for authorized callers
        vaultUtilization = utilization;
    }

    /// @notice Update market volatility estimate
    /// @param marketId Market identifier
    /// @param volatility Volatility estimate (WAD)
    function updateVolatility(bytes32 marketId, uint256 volatility) external {
        // TODO: Add access control
        marketVolatility[marketId] = volatility;
    }

    /// @notice Update current OI (called by PerpEngine)
    /// @param marketId Market identifier
    /// @param oi Current OI
    function updateOI(bytes32 marketId, int256 oi) external {
        // TODO: Add access control
        currentOI[marketId] = oi;
    }

    /// @notice Set index engine address
    /// @param _indexEngine New index engine
    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Compute current risk parameters for a market
    function _computeRiskParams(bytes32 marketId) internal view returns (RiskParams memory) {
        BaseRiskParams storage base = baseParams[marketId];

        if (!base.isConfigured) {
            return RiskParams({
                effectiveLeverage: WAD,
                effectiveSpread: 1e15, // 0.1% default
                effectiveOICap: 0,
                closeOnly: true,
                increaseOnly: false
            });
        }

        uint256 confidence = indexEngine.getConfidence(marketId);
        Regime regime = indexEngine.getRegime(marketId);

        // Effective leverage
        uint256 scaledLev = base.maxLeverage.mulWad(confidence);
        uint256 effLeverage = MathLib.clamp(scaledLev, WAD, base.maxLeverage);

        // Effective spread
        uint256 effSpread = _computeSpread(
            marketId,
            confidence,
            vaultUtilization,
            marketVolatility[marketId]
        );

        // Effective OI cap
        int256 oi = currentOI[marketId];
        uint256 absOI = MathLib.abs(oi);
        uint256 capacityFactor = absOI >= base.maxOI ? 0 : WAD - (absOI * WAD / base.maxOI);
        uint256 effOICap = base.maxOI.mulWad(confidence).mulWad(capacityFactor);

        // Close-only check
        bool isCloseOnly = closeOnlyMarkets[marketId] ||
            regime == Regime.STRESS ||
            confidence < stressThreshold;

        return RiskParams({
            effectiveLeverage: effLeverage,
            effectiveSpread: effSpread,
            effectiveOICap: effOICap,
            closeOnly: isCloseOnly,
            increaseOnly: false
        });
    }

    /// @dev Compute spread based on all factors
    /// spread = s0 + s1*(1-C) + s2*vol + s3*util
    function _computeSpread(
        bytes32 marketId,
        uint256 confidence,
        uint256 utilization,
        uint256 volatility
    ) internal view returns (uint256) {
        BaseRiskParams storage base = baseParams[marketId];
        if (!base.isConfigured) return 1e15; // 0.1% default

        uint256 spread = base.spreadBase;

        // Confidence component: s1 * (1 - C)
        spread += base.spreadConf.mulWad(WAD - confidence);

        // Volatility component: s2 * vol
        spread += base.spreadVol.mulWad(volatility);

        // Utilization component: s3 * util
        spread += base.spreadUtil.mulWad(utilization);

        return spread;
    }
}
