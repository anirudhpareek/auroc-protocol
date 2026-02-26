// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IOracleRouter } from "../interfaces/IOracleRouter.sol";
import { IOracleAdapter } from "../interfaces/IOracleAdapter.sol";
import { AggregatedPrice, OracleSource, OraclePrice } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title OracleRouter
/// @notice Aggregates multiple oracle sources with confidence scoring
/// @dev Implements trimmed weighted mean over log prices with MAD-based dispersion
contract OracleRouter is IOracleRouter, Ownable2Step, ReentrancyGuard {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;
    uint256 public constant MAX_SOURCES = 10;

    // ============================================
    // STATE
    // ============================================

    /// @notice Oracle configuration
    uint256 public maxStaleness;    // Max price age before stale (seconds)
    uint256 public tauDecay;        // Weight decay time constant (seconds)
    uint256 public targetSources;   // Target sources for full C_src
    uint256 public s0Dispersion;    // Dispersion scale for C_disp

    /// @notice Sources per market: marketId => array of sources
    mapping(bytes32 => OracleSource[]) internal _sources;

    /// @notice Primary source index per market
    mapping(bytes32 => uint256) internal _primaryIndex;

    /// @notice Quick lookup: marketId => source => index + 1 (0 means not found)
    mapping(bytes32 => mapping(address => uint256)) internal _sourceIndex;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        uint256 _maxStaleness,
        uint256 _tauDecay,
        uint256 _targetSources,
        uint256 _s0Dispersion
    ) Ownable(msg.sender) {
        maxStaleness = _maxStaleness;
        tauDecay = _tauDecay;
        targetSources = _targetSources;
        s0Dispersion = _s0Dispersion;
    }

    // ============================================
    // VIEWS - IOracleRouter
    // ============================================

    /// @inheritdoc IOracleRouter
    function getAggregatedPrice(bytes32 marketId) external view override returns (AggregatedPrice memory) {
        OracleSource[] storage sources = _sources[marketId];
        if (sources.length == 0) revert NoValidSources();

        // Collect valid prices
        uint256[] memory validPrices = new uint256[](sources.length);
        uint256[] memory weights = new uint256[](sources.length);
        uint256[] memory ages = new uint256[](sources.length);
        uint256 validCount = 0;

        for (uint256 i = 0; i < sources.length; i++) {
            if (!sources[i].isActive) continue;

            try IOracleAdapter(sources[i].source).getPrice(marketId) returns (OraclePrice memory op) {
                uint256 age = block.timestamp > op.timestamp ? block.timestamp - op.timestamp : 0;

                // Skip stale prices
                if (age > maxStaleness) continue;

                validPrices[validCount] = op.price;
                ages[validCount] = age;

                // Weight = liquidity * exp(-age/tau) * source weight
                uint256 decayFactor = MathLib.expNeg((age * WAD) / tauDecay);
                weights[validCount] = op.liquidity.mulWad(decayFactor).mulWad(sources[i].weight);

                validCount++;
            } catch {
                // Source failed, skip
                continue;
            }
        }

        if (validCount == 0) revert NoValidSources();

        // Compute synthetic price via trimmed weighted mean of log prices
        uint256 syntheticPrice = _computeSyntheticPrice(validPrices, weights, validCount);

        // Compute dispersion via MAD
        uint256 dispersion = _computeDispersion(validPrices, validCount);

        // Compute confidence
        uint256 confidence = _computeConfidence(ages, dispersion, validCount);

        return AggregatedPrice({
            price: syntheticPrice,
            confidence: confidence,
            dispersion: dispersion,
            sourceCount: validCount,
            timestamp: block.timestamp
        });
    }

    /// @inheritdoc IOracleRouter
    function getPrimaryPrice(bytes32 marketId) external view override returns (uint256 price, uint256 timestamp) {
        OracleSource[] storage sources = _sources[marketId];
        if (sources.length == 0) revert NoValidSources();

        uint256 primaryIdx = _primaryIndex[marketId];
        OracleSource storage primary = sources[primaryIdx];

        if (!primary.isActive) revert NoValidSources();

        OraclePrice memory op = IOracleAdapter(primary.source).getPrice(marketId);
        uint256 age = block.timestamp > op.timestamp ? block.timestamp - op.timestamp : 0;

        if (age > maxStaleness) revert StalePrice();

        return (op.price, op.timestamp);
    }

    /// @inheritdoc IOracleRouter
    function getSources(bytes32 marketId) external view override returns (OracleSource[] memory) {
        return _sources[marketId];
    }

    /// @inheritdoc IOracleRouter
    function getRawPrice(
        address source,
        bytes32 marketId
    ) external view override returns (OraclePrice memory) {
        return IOracleAdapter(source).getPrice(marketId);
    }

    /// @inheritdoc IOracleRouter
    function getConfig() external view override returns (uint256, uint256, uint256) {
        return (maxStaleness, tauDecay, targetSources);
    }

    // ============================================
    // ADMIN - IOracleRouter
    // ============================================

    /// @inheritdoc IOracleRouter
    function addSource(
        bytes32 marketId,
        address source,
        uint256 weight,
        bool isPrimary
    ) external override onlyOwner {
        if (source == address(0)) revert InvalidAddress();
        if (weight == 0 || weight > WAD) revert InvalidWeight();
        if (_sourceIndex[marketId][source] != 0) revert SourceAlreadyExists();
        if (_sources[marketId].length >= MAX_SOURCES) revert InvalidWeight(); // Reuse error

        _sources[marketId].push(OracleSource({
            source: source,
            weight: weight,
            isPrimary: isPrimary,
            isActive: true
        }));

        uint256 newIndex = _sources[marketId].length; // 1-indexed for lookup
        _sourceIndex[marketId][source] = newIndex;

        if (isPrimary) {
            _primaryIndex[marketId] = newIndex - 1; // 0-indexed for array
        }

        emit SourceAdded(marketId, source, weight, isPrimary);
    }

    /// @inheritdoc IOracleRouter
    function removeSource(bytes32 marketId, address source) external override onlyOwner {
        uint256 indexPlusOne = _sourceIndex[marketId][source];
        if (indexPlusOne == 0) revert SourceNotFound();

        uint256 index = indexPlusOne - 1;
        OracleSource[] storage sources = _sources[marketId];
        uint256 lastIndex = sources.length - 1;

        // Move last element to deleted position
        if (index != lastIndex) {
            sources[index] = sources[lastIndex];
            _sourceIndex[marketId][sources[index].source] = indexPlusOne;

            // Update primary index if needed
            if (_primaryIndex[marketId] == lastIndex) {
                _primaryIndex[marketId] = index;
            }
        }

        sources.pop();
        delete _sourceIndex[marketId][source];

        emit SourceRemoved(marketId, source);
    }

    /// @inheritdoc IOracleRouter
    function updateSource(
        bytes32 marketId,
        address source,
        uint256 weight,
        bool isActive
    ) external override onlyOwner {
        uint256 indexPlusOne = _sourceIndex[marketId][source];
        if (indexPlusOne == 0) revert SourceNotFound();
        if (weight == 0 || weight > WAD) revert InvalidWeight();

        uint256 index = indexPlusOne - 1;
        _sources[marketId][index].weight = weight;
        _sources[marketId][index].isActive = isActive;

        emit SourceUpdated(marketId, source, weight, isActive);
    }

    /// @inheritdoc IOracleRouter
    function setConfig(
        uint256 _maxStaleness,
        uint256 _tauDecay,
        uint256 _targetSources
    ) external override onlyOwner {
        maxStaleness = _maxStaleness;
        tauDecay = _tauDecay;
        targetSources = _targetSources;

        emit ConfigUpdated(_maxStaleness, _tauDecay, _targetSources);
    }

    /// @notice Set dispersion scale parameter
    /// @param _s0Dispersion New s0 value
    function setDispersionScale(uint256 _s0Dispersion) external onlyOwner {
        s0Dispersion = _s0Dispersion;
    }

    // ============================================
    // INTERNAL - PRICE COMPUTATION
    // ============================================

    /// @dev Compute synthetic price as weighted mean of log prices
    /// P_syn = exp(sum(w_i * ln(p_i)) / sum(w_i))
    function _computeSyntheticPrice(
        uint256[] memory prices,
        uint256[] memory weights,
        uint256 count
    ) internal pure returns (uint256) {
        if (count == 1) return prices[0];

        int256 weightedSum = 0;
        uint256 totalWeight = 0;

        for (uint256 i = 0; i < count; i++) {
            int256 logPrice = MathLib.ln(prices[i]);
            weightedSum += logPrice * int256(weights[i]) / int256(WAD);
            totalWeight += weights[i];
        }

        if (totalWeight == 0) return prices[0];

        int256 avgLogPrice = (weightedSum * int256(WAD)) / int256(totalWeight);
        return MathLib.exp(avgLogPrice);
    }

    /// @dev Compute dispersion as MAD (Median Absolute Deviation) of log prices
    /// sigma = 1.4826 * median(|ln(p_i) - median(ln(p))|)
    function _computeDispersion(
        uint256[] memory prices,
        uint256 count
    ) internal pure returns (uint256) {
        if (count <= 1) return 0;

        // Convert to log prices
        int256[] memory logPrices = new int256[](count);
        for (uint256 i = 0; i < count; i++) {
            logPrices[i] = MathLib.ln(prices[i]);
        }

        // Find median of log prices
        int256 medianLog = MathLib.medianInt(logPrices);

        // Compute absolute deviations
        uint256[] memory deviations = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            deviations[i] = MathLib.abs(logPrices[i] - medianLog);
        }

        // MAD = median of deviations
        uint256 mad = MathLib.median(deviations);

        // sigma = 1.4826 * MAD (scale factor for normal distribution)
        // 1.4826e18 in WAD
        uint256 sigma = (mad * 1482600000000000000) / WAD;

        return sigma;
    }

    /// @dev Compute confidence score
    /// C = C_age * C_disp * C_src
    function _computeConfidence(
        uint256[] memory ages,
        uint256 dispersion,
        uint256 count
    ) internal view returns (uint256) {
        // C_age = clamp(1 - median(age)/maxStaleness, 0, 1)
        uint256 medianAge = _medianOfSubset(ages, count);
        uint256 cAge;
        if (medianAge >= maxStaleness) {
            cAge = 0;
        } else {
            cAge = WAD - (medianAge * WAD) / maxStaleness;
        }

        // C_disp = exp(-sigma/s0)
        uint256 cDisp;
        if (s0Dispersion == 0) {
            cDisp = WAD;
        } else {
            uint256 dispRatio = (dispersion * WAD) / s0Dispersion;
            cDisp = MathLib.expNeg(dispRatio);
        }

        // C_src = clamp(n_sources/target_sources, 0, 1)
        uint256 cSrc;
        if (count >= targetSources) {
            cSrc = WAD;
        } else {
            cSrc = (count * WAD) / targetSources;
        }

        // C = C_age * C_disp * C_src
        uint256 confidence = cAge.mulWad(cDisp).mulWad(cSrc);

        return confidence;
    }

    /// @dev Calculate median of first `count` elements
    function _medianOfSubset(uint256[] memory arr, uint256 count) internal pure returns (uint256) {
        if (count == 0) return 0;
        if (count == 1) return arr[0];

        // Copy subset
        uint256[] memory subset = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            subset[i] = arr[i];
        }

        return MathLib.median(subset);
    }
}
