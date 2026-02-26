// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IFundingEngine } from "../interfaces/IFundingEngine.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { IPerpEngine } from "../interfaces/IPerpEngine.sol";
import { Regime } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title FundingEngine
/// @notice Calculates and tracks funding rates with confidence damping
/// @dev Funding rate = ((P_mark - P_index) / P_index + gamma * imbalance) * C
contract FundingEngine is IFundingEngine, Ownable2Step {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice Index engine for prices and regime
    IIndexEngine public indexEngine;

    /// @notice Perp engine for OI data
    IPerpEngine public perpEngine;

    /// @notice Funding interval in seconds
    uint256 public fundingInterval;

    /// @notice Off-hours funding clamp multiplier (< 1 means tighter)
    uint256 public offHoursClampMultiplier;

    /// @notice Per-market funding parameters
    struct FundingParams {
        uint256 maxRate;          // Max funding rate per interval (WAD)
        uint256 imbalanceWeight;  // Gamma - imbalance contribution (WAD)
        bool isConfigured;
    }

    mapping(bytes32 => FundingParams) public fundingParams;

    /// @notice Per-market funding state
    struct FundingState {
        int256 cumulativeFunding;  // Cumulative funding per unit size
        int256 lastRate;           // Last computed funding rate
        uint256 lastUpdateTime;    // Last update timestamp
    }

    mapping(bytes32 => FundingState) public fundingStates;

    /// @notice Registered markets
    bytes32[] public registeredMarkets;
    mapping(bytes32 => bool) public isRegistered;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _indexEngine,
        uint256 _fundingInterval,
        uint256 _offHoursClampMultiplier
    ) Ownable(msg.sender) {
        indexEngine = IIndexEngine(_indexEngine);
        fundingInterval = _fundingInterval;
        offHoursClampMultiplier = _offHoursClampMultiplier;
    }

    // ============================================
    // VIEWS - IFundingEngine
    // ============================================

    /// @inheritdoc IFundingEngine
    function getFundingRate(bytes32 marketId) external view override returns (int256) {
        return _computeFundingRate(marketId);
    }

    /// @inheritdoc IFundingEngine
    function getCumulativeFunding(bytes32 marketId) external view override returns (int256) {
        FundingState storage state = fundingStates[marketId];

        // Add pending funding since last update
        uint256 timeDelta = block.timestamp - state.lastUpdateTime;
        if (timeDelta == 0) return state.cumulativeFunding;

        int256 currentRate = _computeFundingRate(marketId);
        uint256 periods = timeDelta / fundingInterval;

        // Linear interpolation for partial periods
        int256 pendingFunding = (currentRate * int256(periods));

        return state.cumulativeFunding + pendingFunding;
    }

    /// @inheritdoc IFundingEngine
    function getPendingFunding(bytes32 positionId) external view override returns (int256) {
        // This would need position data - delegate to PerpEngine
        // For now, return 0 as this is called via PerpEngine
        return 0;
    }

    /// @inheritdoc IFundingEngine
    function getTimeSinceUpdate(bytes32 marketId) external view override returns (uint256) {
        return block.timestamp - fundingStates[marketId].lastUpdateTime;
    }

    /// @inheritdoc IFundingEngine
    function getFundingParams(bytes32 marketId)
        external
        view
        override
        returns (uint256 maxRate, uint256 imbalanceWeight, uint256 interval)
    {
        FundingParams storage params = fundingParams[marketId];
        return (params.maxRate, params.imbalanceWeight, fundingInterval);
    }

    // ============================================
    // STATE CHANGES - IFundingEngine
    // ============================================

    /// @inheritdoc IFundingEngine
    function updateFunding(bytes32 marketId) external override {
        _updateFunding(marketId);
    }

    /// @inheritdoc IFundingEngine
    function updateAllFunding() external override {
        for (uint256 i = 0; i < registeredMarkets.length; i++) {
            _updateFunding(registeredMarkets[i]);
        }
    }

    // ============================================
    // CONFIG - IFundingEngine
    // ============================================

    /// @inheritdoc IFundingEngine
    function setFundingParams(
        bytes32 marketId,
        uint256 maxRate,
        uint256 imbalanceWeight
    ) external override onlyOwner {
        fundingParams[marketId] = FundingParams({
            maxRate: maxRate,
            imbalanceWeight: imbalanceWeight,
            isConfigured: true
        });

        if (!isRegistered[marketId]) {
            registeredMarkets.push(marketId);
            isRegistered[marketId] = true;
        }

        emit FundingParamsUpdated(marketId, maxRate, imbalanceWeight);
    }

    /// @inheritdoc IFundingEngine
    function setFundingInterval(uint256 interval) external override onlyOwner {
        require(interval > 0, "ZERO_INTERVAL");
        fundingInterval = interval;
    }

    /// @inheritdoc IFundingEngine
    function setOffHoursClampMultiplier(uint256 multiplier) external override onlyOwner {
        require(multiplier <= WAD, "INVALID_MULTIPLIER");
        offHoursClampMultiplier = multiplier;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Set index engine
    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }

    /// @notice Set perp engine
    function setPerpEngine(address _perpEngine) external onlyOwner {
        perpEngine = IPerpEngine(_perpEngine);
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Compute current funding rate for a market
    /// F = (F_raw + gamma * imbalance) * C
    /// F_raw = clamp((P_mark - P_index) / P_index, -fmax, fmax)
    function _computeFundingRate(bytes32 marketId) internal view returns (int256) {
        FundingParams storage params = fundingParams[marketId];
        if (!params.isConfigured) return 0;

        // Get prices
        uint256 markPrice = indexEngine.getMarkPrice(marketId);
        uint256 indexPrice = indexEngine.getIndexPrice(marketId);
        uint256 confidence = indexEngine.getConfidence(marketId);
        Regime regime = indexEngine.getRegime(marketId);

        if (indexPrice == 0) return 0;

        // F_raw = (P_mark - P_index) / P_index
        int256 priceDiff = int256(markPrice) - int256(indexPrice);
        int256 fRaw = (priceDiff * int256(WAD)) / int256(indexPrice);

        // Determine max rate based on regime
        uint256 maxRate = params.maxRate;
        if (regime == Regime.OFF_HOURS || regime == Regime.STRESS) {
            // Tighter clamp during off-hours
            maxRate = maxRate.mulWad(offHoursClampMultiplier);
        }

        // Clamp F_raw
        fRaw = MathLib.clampInt(fRaw, -int256(maxRate), int256(maxRate));

        // Add imbalance component
        // imbalance = (longOI - shortOI) / totalOI
        // For now, use net OI from perp engine
        int256 imbalanceComponent = 0;
        if (address(perpEngine) != address(0)) {
            // Get OI from perp engine market state
            // This is a simplified version - full impl would need more data
            // imbalanceComponent = gamma * imbalance
        }

        // Total raw rate
        int256 totalRaw = fRaw + imbalanceComponent;

        // Apply confidence damping: F = totalRaw * C
        int256 fundingRate = (totalRaw * int256(confidence)) / int256(WAD);

        return fundingRate;
    }

    /// @dev Update funding for a market
    function _updateFunding(bytes32 marketId) internal {
        FundingState storage state = fundingStates[marketId];

        uint256 timeDelta = block.timestamp - state.lastUpdateTime;
        if (timeDelta < fundingInterval) return; // Too soon

        // Compute periods elapsed
        uint256 periods = timeDelta / fundingInterval;
        if (periods == 0) return;

        // Get current rate
        int256 currentRate = _computeFundingRate(marketId);

        // Update cumulative funding
        // Using simple linear model: cumulative += rate * periods
        state.cumulativeFunding += currentRate * int256(periods);
        state.lastRate = currentRate;
        state.lastUpdateTime = block.timestamp;

        emit FundingUpdated(marketId, currentRate, state.cumulativeFunding);
    }
}
