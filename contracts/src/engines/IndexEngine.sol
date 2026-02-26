// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { IOracleRouter } from "../interfaces/IOracleRouter.sol";
import { Regime, MarketState, TransitionState, AggregatedPrice } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title IndexEngine
/// @notice Manages regime states and computes index/mark prices for RWA markets
/// @dev Handles OPEN, OFF_HOURS, TRANSITION, and STRESS regimes
contract IndexEngine is IIndexEngine, Ownable2Step, Pausable {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice Oracle router for price feeds
    IOracleRouter public oracleRouter;

    /// @notice Mark price clamp parameters
    uint256 public d0Clamp;  // Base clamp (WAD)
    uint256 public d1Clamp;  // Confidence-scaled clamp (WAD)

    /// @notice Confidence threshold for STRESS mode
    uint256 public stressThreshold;

    /// @notice Default transition duration
    uint256 public defaultTransitionDuration;

    /// @notice Market states
    mapping(bytes32 => MarketState) public marketStates;

    /// @notice Transition states
    mapping(bytes32 => TransitionState) public transitionStates;

    /// @notice Registered markets
    mapping(bytes32 => bool) public registeredMarkets;

    /// @notice Authorized updaters (keepers)
    mapping(address => bool) public authorizedUpdaters;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _oracleRouter,
        uint256 _d0Clamp,
        uint256 _d1Clamp,
        uint256 _stressThreshold,
        uint256 _defaultTransitionDuration
    ) Ownable(msg.sender) {
        oracleRouter = IOracleRouter(_oracleRouter);
        d0Clamp = _d0Clamp;
        d1Clamp = _d1Clamp;
        stressThreshold = _stressThreshold;
        defaultTransitionDuration = _defaultTransitionDuration;
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyAuthorized() {
        if (msg.sender != owner() && !authorizedUpdaters[msg.sender]) {
            revert UnauthorizedCaller();
        }
        _;
    }

    modifier marketExists(bytes32 marketId) {
        if (!registeredMarkets[marketId]) revert MarketNotFound();
        _;
    }

    // ============================================
    // VIEWS - IIndexEngine
    // ============================================

    /// @inheritdoc IIndexEngine
    function getIndexPrice(bytes32 marketId) external view override marketExists(marketId) returns (uint256) {
        return _computeIndexPrice(marketId);
    }

    /// @inheritdoc IIndexEngine
    function getMarkPrice(bytes32 marketId) external view override marketExists(marketId) returns (uint256) {
        return _computeMarkPrice(marketId);
    }

    /// @inheritdoc IIndexEngine
    function getRegime(bytes32 marketId) external view override returns (Regime) {
        return marketStates[marketId].regime;
    }

    /// @inheritdoc IIndexEngine
    function getConfidence(bytes32 marketId) external view override marketExists(marketId) returns (uint256) {
        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);
        return agg.confidence;
    }

    /// @inheritdoc IIndexEngine
    function getMarketState(bytes32 marketId) external view override returns (MarketState memory) {
        return marketStates[marketId];
    }

    /// @inheritdoc IIndexEngine
    function getTransitionState(bytes32 marketId) external view override returns (TransitionState memory) {
        return transitionStates[marketId];
    }

    /// @inheritdoc IIndexEngine
    function canTrade(bytes32 marketId, bool isIncrease) external view override returns (bool) {
        MarketState storage state = marketStates[marketId];

        // STRESS mode: close only
        if (state.regime == Regime.STRESS) {
            return !isIncrease; // Can only decrease/close
        }

        // TRANSITION mode: may have restrictions
        if (state.regime == Regime.TRANSITION) {
            TransitionState storage trans = transitionStates[marketId];
            // If gap is large, restrict increases
            if (trans.maxGapPercent > 5e16 && isIncrease) { // > 5% gap
                return false;
            }
        }

        return true;
    }

    // ============================================
    // STATE CHANGES - IIndexEngine
    // ============================================

    /// @inheritdoc IIndexEngine
    function updateMarket(bytes32 marketId) external override whenNotPaused marketExists(marketId) {
        MarketState storage state = marketStates[marketId];

        // Get fresh oracle data
        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);

        // Check for STRESS trigger
        if (agg.confidence < stressThreshold && state.regime != Regime.STRESS) {
            _setRegime(marketId, Regime.STRESS, "Low confidence");
        }

        // Update cached values
        state.lastConfidence = agg.confidence;
        state.lastIndexPrice = _computeIndexPrice(marketId);
        state.lastMarkPrice = _computeMarkPrice(marketId);

        // Handle transition completion
        if (state.regime == Regime.TRANSITION) {
            TransitionState storage trans = transitionStates[marketId];
            if (trans.isActive && block.timestamp >= trans.startTime + trans.duration) {
                _completeTransition(marketId);
            }
        }

        emit MarkPriceUpdated(marketId, state.lastMarkPrice, state.lastIndexPrice);
        emit ConfidenceUpdated(marketId, agg.confidence);
    }

    /// @inheritdoc IIndexEngine
    function setRegime(bytes32 marketId, Regime newRegime) external override onlyOwner marketExists(marketId) {
        _setRegime(marketId, newRegime, "Admin override");
    }

    /// @inheritdoc IIndexEngine
    function startTransition(
        bytes32 marketId,
        uint256 duration
    ) external override onlyAuthorized marketExists(marketId) {
        MarketState storage state = marketStates[marketId];
        TransitionState storage trans = transitionStates[marketId];

        if (trans.isActive) revert TransitionAlreadyActive();

        // Get current synthetic price before transition
        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);

        // Try to get primary price to calculate gap
        uint256 gapPercent = 0;
        try oracleRouter.getPrimaryPrice(marketId) returns (uint256 primaryPrice, uint256) {
            if (primaryPrice > 0 && agg.price > 0) {
                int256 gap = int256(primaryPrice) - int256(agg.price);
                gapPercent = MathLib.abs(gap) * WAD / agg.price;
            }
        } catch {
            // Primary not available, use 0 gap
        }

        trans.startTime = block.timestamp;
        trans.duration = duration > 0 ? duration : defaultTransitionDuration;
        trans.preSynPrice = agg.price;
        trans.maxGapPercent = gapPercent;
        trans.isActive = true;

        _setRegime(marketId, Regime.TRANSITION, "Market reopen");

        emit TransitionStarted(marketId, trans.duration, gapPercent);
    }

    /// @inheritdoc IIndexEngine
    function activateStress(
        bytes32 marketId,
        string calldata reason
    ) external override onlyAuthorized marketExists(marketId) {
        _setRegime(marketId, Regime.STRESS, reason);
    }

    // ============================================
    // CONFIG - IIndexEngine
    // ============================================

    /// @inheritdoc IIndexEngine
    function setClampParams(uint256 _d0, uint256 _d1) external override onlyOwner {
        d0Clamp = _d0;
        d1Clamp = _d1;
    }

    /// @inheritdoc IIndexEngine
    function setStressThreshold(uint256 threshold) external override onlyOwner {
        stressThreshold = threshold;
    }

    /// @inheritdoc IIndexEngine
    function setDefaultTransitionDuration(uint256 duration) external override onlyOwner {
        defaultTransitionDuration = duration;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Register a new market
    /// @param marketId Market identifier
    /// @param initialRegime Initial regime state
    function registerMarket(bytes32 marketId, Regime initialRegime) external onlyOwner {
        registeredMarkets[marketId] = true;
        marketStates[marketId].regime = initialRegime;
        marketStates[marketId].regimeChangedAt = block.timestamp;

        emit RegimeChanged(marketId, Regime.OPEN, initialRegime, block.timestamp);
    }

    /// @notice Set oracle router address
    /// @param _oracleRouter New oracle router
    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = IOracleRouter(_oracleRouter);
    }

    /// @notice Authorize an updater (keeper)
    /// @param updater Address to authorize
    /// @param authorized Authorization status
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
    }

    /// @notice Pause the engine (emergency)
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the engine
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Compute index price based on current regime
    function _computeIndexPrice(bytes32 marketId) internal view returns (uint256) {
        MarketState storage state = marketStates[marketId];
        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);

        if (state.regime == Regime.OPEN) {
            // Use primary feed
            try oracleRouter.getPrimaryPrice(marketId) returns (uint256 price, uint256) {
                return price;
            } catch {
                // Fallback to synthetic
                return agg.price;
            }
        }

        if (state.regime == Regime.OFF_HOURS || state.regime == Regime.STRESS) {
            // Use synthetic price
            return agg.price;
        }

        if (state.regime == Regime.TRANSITION) {
            // Blend: P_index(t) = (1-alpha)*P_syn + alpha*P_primary
            return _computeTransitionPrice(marketId, agg.price);
        }

        return agg.price;
    }

    /// @dev Compute transition price with alpha ramp
    function _computeTransitionPrice(bytes32 marketId, uint256 synPrice) internal view returns (uint256) {
        TransitionState storage trans = transitionStates[marketId];

        if (!trans.isActive) return synPrice;

        uint256 elapsed = block.timestamp - trans.startTime;
        if (elapsed >= trans.duration) {
            // Transition complete, use primary
            try oracleRouter.getPrimaryPrice(marketId) returns (uint256 price, uint256) {
                return price;
            } catch {
                return synPrice;
            }
        }

        // alpha = t / T_trans (clamped to [0, 1])
        uint256 alpha = (elapsed * WAD) / trans.duration;
        if (alpha > WAD) alpha = WAD;

        // Get primary price
        uint256 primaryPrice;
        try oracleRouter.getPrimaryPrice(marketId) returns (uint256 price, uint256) {
            primaryPrice = price;
        } catch {
            return synPrice;
        }

        // P_index = (1-alpha)*P_syn + alpha*P_primary
        uint256 synComponent = synPrice.mulWad(WAD - alpha);
        uint256 primaryComponent = primaryPrice.mulWad(alpha);

        return synComponent + primaryComponent;
    }

    /// @dev Compute mark price with blend and clamp
    function _computeMarkPrice(bytes32 marketId) internal view returns (uint256) {
        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);
        uint256 indexPrice = _computeIndexPrice(marketId);
        uint256 C = agg.confidence;

        // P_mid = (bid + ask) / 2, for now use index as mid
        // In production, this could come from an order book or other source
        uint256 pMid = indexPrice;

        // P_blend = C * P_index + (1-C) * P_mid
        uint256 pBlend = indexPrice.mulWad(C) + pMid.mulWad(WAD - C);

        // d = d0 + d1 * (1 - C)
        uint256 d = d0Clamp + d1Clamp.mulWad(WAD - C);

        // P_mark = clamp(P_blend, P_index*(1-d), P_index*(1+d))
        uint256 lowerBound = indexPrice.mulWad(WAD - d);
        uint256 upperBound = indexPrice.mulWad(WAD + d);

        return MathLib.clamp(pBlend, lowerBound, upperBound);
    }

    /// @dev Set regime with event emission
    function _setRegime(bytes32 marketId, Regime newRegime, string memory reason) internal {
        MarketState storage state = marketStates[marketId];
        Regime oldRegime = state.regime;

        if (oldRegime == newRegime) return;

        state.regime = newRegime;
        state.regimeChangedAt = block.timestamp;

        emit RegimeChanged(marketId, oldRegime, newRegime, block.timestamp);

        if (newRegime == Regime.STRESS) {
            emit StressModeActivated(marketId, reason);
        }
    }

    /// @dev Complete transition and move to OPEN
    function _completeTransition(bytes32 marketId) internal {
        TransitionState storage trans = transitionStates[marketId];

        trans.isActive = false;
        trans.startTime = 0;
        trans.duration = 0;
        trans.preSynPrice = 0;
        trans.maxGapPercent = 0;

        _setRegime(marketId, Regime.OPEN, "Transition complete");

        emit TransitionCompleted(marketId);
    }
}
