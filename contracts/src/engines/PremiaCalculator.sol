// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MathLib } from "../libraries/MathLib.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title PremiaCalculator
/// @notice Risk-based pricing engine inspired by Vest's zkRisk
/// @dev Calculates trade premia based on marginal risk contribution
///
/// Instead of flat impact fees, each trade is priced based on how much
/// risk it adds to the system. This:
/// 1. Naturally limits large positions (higher risk = higher cost)
/// 2. Rewards risk-reducing trades (negative premia = better price)
/// 3. Eliminates need for hard OI caps
contract PremiaCalculator is Ownable2Step {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;
    uint256 public constant MAX_PREMIA = 5e16; // 5% max premia

    // ============================================
    // STATE
    // ============================================

    /// @notice Index engine for confidence data
    IIndexEngine public indexEngine;

    /// @notice Base premia rate (WAD)
    uint256 public basePremiaRate;

    /// @notice Concentration risk multiplier
    uint256 public concentrationMultiplier;

    /// @notice Volatility risk multiplier
    uint256 public volatilityMultiplier;

    /// @notice Confidence risk multiplier (lower C = higher premia)
    uint256 public confidenceMultiplier;

    /// @notice Per-market portfolio state for risk calculation
    struct PortfolioState {
        int256 netExposure;      // Net USD exposure (long - short)
        uint256 grossExposure;   // Total USD exposure (long + short)
        uint256 concentration;   // Largest single position as % of total
        uint256 volatility;      // Recent volatility estimate
    }

    mapping(bytes32 => PortfolioState) public portfolioStates;

    /// @notice Per-market risk parameters
    struct MarketRiskParams {
        uint256 maxExposure;     // Max gross exposure before elevated premia
        uint256 baseVolatility;  // Historical volatility baseline
        bool isConfigured;
    }

    mapping(bytes32 => MarketRiskParams) public marketRiskParams;

    // ============================================
    // EVENTS
    // ============================================

    event PremiaCalculated(
        bytes32 indexed marketId,
        int256 sizeDelta,
        uint256 premia,
        uint256 riskBefore,
        uint256 riskAfter
    );
    event PortfolioRiskUpdated(bytes32 indexed marketId, uint256 riskScore);

    // ============================================
    // ERRORS
    // ============================================

    error MarketNotConfigured();
    error InvalidParams();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _indexEngine,
        uint256 _basePremiaRate,
        uint256 _concentrationMultiplier,
        uint256 _volatilityMultiplier,
        uint256 _confidenceMultiplier
    ) Ownable(msg.sender) {
        indexEngine = IIndexEngine(_indexEngine);
        basePremiaRate = _basePremiaRate;
        concentrationMultiplier = _concentrationMultiplier;
        volatilityMultiplier = _volatilityMultiplier;
        confidenceMultiplier = _confidenceMultiplier;
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Calculate premia for a trade based on risk contribution
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive = long, negative = short)
    /// @param tradeNotional Notional value of trade in USD
    /// @return premia Premia as price adjustment (WAD)
    /// @return isRiskReducing True if trade reduces overall risk
    function calculatePremia(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 tradeNotional
    ) external view returns (uint256 premia, bool isRiskReducing) {
        MarketRiskParams storage params = marketRiskParams[marketId];
        if (!params.isConfigured) revert MarketNotConfigured();

        PortfolioState storage state = portfolioStates[marketId];

        // Calculate risk before trade
        uint256 riskBefore = _calculateRiskScore(marketId, state);

        // Calculate risk after trade (simulated)
        PortfolioState memory newState = _simulateTradeImpact(state, sizeDelta, tradeNotional);
        uint256 riskAfter = _calculateRiskScore(marketId, newState);

        // Premia = (riskAfter - riskBefore) * basePremiaRate
        if (riskAfter > riskBefore) {
            // Trade increases risk - charge premia
            uint256 riskIncrease = riskAfter - riskBefore;
            premia = riskIncrease.mulWad(basePremiaRate);
            isRiskReducing = false;
        } else {
            // Trade reduces risk - reward with negative premia (better price)
            uint256 riskDecrease = riskBefore - riskAfter;
            premia = riskDecrease.mulWad(basePremiaRate);
            isRiskReducing = true;
        }

        // Apply confidence adjustment
        uint256 confidence = indexEngine.getConfidence(marketId);
        if (confidence < WAD) {
            // Lower confidence = higher premia for risk-increasing trades
            uint256 confidenceDiscount = WAD - confidence;
            uint256 confidenceAdjustment = premia.mulWad(confidenceDiscount).mulWad(confidenceMultiplier);

            if (isRiskReducing) {
                // Boost reward for risk-reducing trades in low confidence
                premia += confidenceAdjustment;
            } else {
                // Increase cost for risk-increasing trades in low confidence
                premia += confidenceAdjustment;
            }
        }

        // Cap premia
        if (premia > MAX_PREMIA) {
            premia = MAX_PREMIA;
        }

        return (premia, isRiskReducing);
    }

    /// @notice Get current risk score for a market
    /// @param marketId Market identifier
    /// @return Risk score (higher = riskier)
    function getRiskScore(bytes32 marketId) external view returns (uint256) {
        return _calculateRiskScore(marketId, portfolioStates[marketId]);
    }

    /// @notice Get portfolio state for a market
    function getPortfolioState(bytes32 marketId) external view returns (PortfolioState memory) {
        return portfolioStates[marketId];
    }

    // ============================================
    // STATE UPDATES
    // ============================================

    /// @notice Update portfolio state when opening/increasing a position
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive = long, negative = short)
    /// @param tradeNotional Trade notional value
    function updatePortfolio(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 tradeNotional
    ) external {
        // Note: Add access control in production
        PortfolioState storage state = portfolioStates[marketId];

        // Update exposures - opening increases both net and gross
        state.netExposure += sizeDelta;
        state.grossExposure += tradeNotional;

        // Update concentration (simplified - in production track individual positions)
        if (state.grossExposure > 0) {
            state.concentration = (tradeNotional * WAD) / state.grossExposure;
        }

        emit PortfolioRiskUpdated(marketId, _calculateRiskScore(marketId, state));
    }

    /// @notice Update portfolio state when closing/decreasing a position
    /// @param marketId Market identifier
    /// @param sizeDelta Original position size being closed (positive = long, negative = short)
    /// @param tradeNotional Trade notional value
    function closePortfolio(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 tradeNotional
    ) external {
        // Note: Add access control in production
        PortfolioState storage state = portfolioStates[marketId];

        // Update exposures - closing decreases both net and gross
        state.netExposure -= sizeDelta;

        if (tradeNotional > state.grossExposure) {
            state.grossExposure = 0;
        } else {
            state.grossExposure -= tradeNotional;
        }

        // Update concentration
        if (state.grossExposure > 0) {
            state.concentration = (tradeNotional * WAD) / state.grossExposure;
        } else {
            state.concentration = 0;
        }

        emit PortfolioRiskUpdated(marketId, _calculateRiskScore(marketId, state));
    }

    /// @notice Update volatility estimate for a market
    /// @param marketId Market identifier
    /// @param volatility New volatility estimate (WAD)
    function updateVolatility(bytes32 marketId, uint256 volatility) external {
        // Note: Add access control in production
        portfolioStates[marketId].volatility = volatility;
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Calculate risk score based on portfolio state
    /// Score = base + concentration_risk + volatility_risk + exposure_risk
    function _calculateRiskScore(
        bytes32 marketId,
        PortfolioState memory state
    ) internal view returns (uint256) {
        MarketRiskParams storage params = marketRiskParams[marketId];
        if (!params.isConfigured) return 0;

        uint256 score = WAD; // Base score of 1

        // Concentration risk: higher if single positions dominate
        uint256 concentrationRisk = state.concentration.mulWad(concentrationMultiplier);
        score += concentrationRisk;

        // Volatility risk: higher if current vol > baseline
        if (state.volatility > params.baseVolatility && params.baseVolatility > 0) {
            uint256 volRatio = (state.volatility * WAD) / params.baseVolatility;
            uint256 volRisk = (volRatio - WAD).mulWad(volatilityMultiplier);
            score += volRisk;
        }

        // Exposure risk: higher as gross exposure approaches max
        if (params.maxExposure > 0) {
            uint256 exposureRatio = (state.grossExposure * WAD) / params.maxExposure;
            if (exposureRatio > WAD) exposureRatio = WAD;
            uint256 exposureRisk = exposureRatio.mulWad(exposureRatio); // Quadratic
            score += exposureRisk;
        }

        // Imbalance risk: higher if net exposure is skewed
        if (state.grossExposure > 0) {
            uint256 absNet = MathLib.abs(state.netExposure);
            uint256 imbalanceRatio = (absNet * WAD) / state.grossExposure;
            score += imbalanceRatio;
        }

        return score;
    }

    /// @dev Simulate trade impact on portfolio state
    function _simulateTradeImpact(
        PortfolioState memory state,
        int256 sizeDelta,
        uint256 tradeNotional
    ) internal pure returns (PortfolioState memory newState) {
        newState.netExposure = state.netExposure + sizeDelta;
        newState.volatility = state.volatility; // Unchanged by single trade

        if (sizeDelta > 0) {
            newState.grossExposure = state.grossExposure + tradeNotional;
        } else {
            newState.grossExposure = tradeNotional > state.grossExposure
                ? 0
                : state.grossExposure - tradeNotional;
        }

        // Update concentration estimate
        if (newState.grossExposure > 0) {
            newState.concentration = (tradeNotional * WAD) / newState.grossExposure;
        }

        return newState;
    }

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Configure risk parameters for a market
    function setMarketRiskParams(
        bytes32 marketId,
        uint256 maxExposure,
        uint256 baseVolatility
    ) external onlyOwner {
        marketRiskParams[marketId] = MarketRiskParams({
            maxExposure: maxExposure,
            baseVolatility: baseVolatility,
            isConfigured: true
        });
    }

    /// @notice Set base premia rate
    function setBasePremiaRate(uint256 rate) external onlyOwner {
        basePremiaRate = rate;
    }

    /// @notice Set risk multipliers
    function setMultipliers(
        uint256 _concentration,
        uint256 _volatility,
        uint256 _confidence
    ) external onlyOwner {
        concentrationMultiplier = _concentration;
        volatilityMultiplier = _volatility;
        confidenceMultiplier = _confidence;
    }

    /// @notice Set index engine
    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }
}
