// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title SkewManager
/// @notice Manages OI skew incentives: loss rebates and positive slippage
/// @dev Inspired by Avantis's innovative incentive mechanisms
///
/// Key Concepts:
/// 1. Loss Rebates: Traders who help balance OI skew get rebates on losses
/// 2. Positive Slippage: Balancing trades get better-than-mark execution
/// 3. The goal is to incentivize natural arbitrage of OI imbalances
contract SkewManager is Ownable2Step {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;
    uint256 public constant MAX_REBATE_RATE = 3e17; // 30% max rebate
    uint256 public constant MAX_POSITIVE_SLIPPAGE = 5e15; // 0.5% max positive slippage

    // ============================================
    // STATE
    // ============================================

    /// @notice Loss rebate rate for balancing trades (WAD)
    uint256 public lossRebateRate;

    /// @notice Positive slippage rate for balancing trades (WAD)
    uint256 public positiveSlippageRate;

    /// @notice Minimum skew ratio to qualify for incentives (WAD)
    /// e.g., 0.1e18 means OI must be 10% skewed to qualify
    uint256 public minSkewForIncentive;

    /// @notice Per-market OI tracking
    mapping(bytes32 => int256) public marketNetOI; // long - short
    mapping(bytes32 => uint256) public marketTotalOI; // long + short

    /// @notice Per-position rebate eligibility (locked at open)
    mapping(bytes32 => bool) public positionRebateEligible;

    /// @notice Total rebates paid out (stats)
    uint256 public totalRebatesPaid;

    // ============================================
    // EVENTS
    // ============================================

    event SkewUpdated(bytes32 indexed marketId, int256 netOI, uint256 totalOI, int256 skewRatio);
    event RebateEligibilityLocked(bytes32 indexed positionId, bool eligible);
    event LossRebatePaid(bytes32 indexed positionId, address indexed trader, uint256 rebateAmount);
    event PositiveSlippageApplied(bytes32 indexed marketId, int256 sizeDelta, uint256 slippageReward);

    // ============================================
    // ERRORS
    // ============================================

    error InvalidRate();
    error Unauthorized();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        uint256 _lossRebateRate,
        uint256 _positiveSlippageRate,
        uint256 _minSkewForIncentive
    ) Ownable(msg.sender) {
        if (_lossRebateRate > MAX_REBATE_RATE) revert InvalidRate();
        if (_positiveSlippageRate > MAX_POSITIVE_SLIPPAGE) revert InvalidRate();

        lossRebateRate = _lossRebateRate;
        positiveSlippageRate = _positiveSlippageRate;
        minSkewForIncentive = _minSkewForIncentive;
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current skew ratio for a market
    /// @param marketId Market identifier
    /// @return skewRatio Signed ratio in WAD (-1 to 1), negative = more shorts
    function getSkewRatio(bytes32 marketId) public view returns (int256) {
        uint256 totalOI = marketTotalOI[marketId];
        if (totalOI == 0) return 0;

        int256 netOI = marketNetOI[marketId];
        return (netOI * int256(WAD)) / int256(totalOI);
    }

    /// @notice Check if a trade would balance the OI skew
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive = long, negative = short)
    /// @return balances True if trade reduces |skew|
    /// @return reductionAmount How much |skew| is reduced (WAD)
    function wouldBalanceSkew(
        bytes32 marketId,
        int256 sizeDelta
    ) public view returns (bool balances, uint256 reductionAmount) {
        int256 currentNetOI = marketNetOI[marketId];
        int256 newNetOI = currentNetOI + sizeDelta;

        uint256 currentAbsSkew = MathLib.abs(currentNetOI);
        uint256 newAbsSkew = MathLib.abs(newNetOI);

        if (newAbsSkew < currentAbsSkew) {
            balances = true;
            reductionAmount = currentAbsSkew - newAbsSkew;
        } else {
            balances = false;
            reductionAmount = 0;
        }
    }

    /// @notice Calculate positive slippage reward for a balancing trade
    /// @param marketId Market identifier
    /// @param sizeDelta Size change
    /// @return slippageReward Reward as price adjustment (WAD, to be subtracted from spread)
    function calculatePositiveSlippage(
        bytes32 marketId,
        int256 sizeDelta
    ) external view returns (uint256 slippageReward) {
        // Check if skew is significant enough
        int256 skewRatio = getSkewRatio(marketId);
        if (MathLib.abs(skewRatio) < minSkewForIncentive) {
            return 0;
        }

        (bool balances, uint256 reductionAmount) = wouldBalanceSkew(marketId, sizeDelta);
        if (!balances) return 0;

        // Reward proportional to how much skew is reduced
        // More skew reduction = more reward, up to max
        uint256 totalOI = marketTotalOI[marketId];
        if (totalOI == 0) return 0;

        uint256 reductionRatio = (reductionAmount * WAD) / totalOI;
        slippageReward = positiveSlippageRate.mulWad(reductionRatio);

        // Cap at max positive slippage
        if (slippageReward > MAX_POSITIVE_SLIPPAGE) {
            slippageReward = MAX_POSITIVE_SLIPPAGE;
        }

        return slippageReward;
    }

    /// @notice Calculate loss rebate for an eligible position
    /// @param positionId Position identifier
    /// @param loss Loss amount (positive value)
    /// @return rebateAmount Rebate to pay trader
    function calculateLossRebate(
        bytes32 positionId,
        uint256 loss
    ) external view returns (uint256 rebateAmount) {
        if (!positionRebateEligible[positionId]) return 0;

        rebateAmount = loss.mulWad(lossRebateRate);
        return rebateAmount;
    }

    /// @notice Check if a new position would qualify for loss rebate
    /// @param marketId Market identifier
    /// @param sizeDelta Size change
    /// @return eligible True if position would be rebate-eligible
    function checkRebateEligibility(
        bytes32 marketId,
        int256 sizeDelta
    ) external view returns (bool eligible) {
        // Must meet minimum skew threshold
        int256 skewRatio = getSkewRatio(marketId);
        if (MathLib.abs(skewRatio) < minSkewForIncentive) {
            return false;
        }

        // Must balance the skew
        (bool balances, ) = wouldBalanceSkew(marketId, sizeDelta);
        return balances;
    }

    // ============================================
    // STATE UPDATES - Called by PerpEngine
    // ============================================

    /// @notice Update OI tracking when position opens
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive = long, negative = short)
    function updateOI(bytes32 marketId, int256 sizeDelta) external {
        // Note: In production, add access control
        // Update net OI (long - short running sum)
        marketNetOI[marketId] += sizeDelta;

        // Update total OI (sum of absolute values)
        uint256 absSize = MathLib.abs(sizeDelta);
        marketTotalOI[marketId] += absSize;

        emit SkewUpdated(
            marketId,
            marketNetOI[marketId],
            marketTotalOI[marketId],
            getSkewRatio(marketId)
        );
    }

    /// @notice Update OI tracking when position closes
    /// @param marketId Market identifier
    /// @param sizeDelta Original position size being closed (positive = long, negative = short)
    function closeOI(bytes32 marketId, int256 sizeDelta) external {
        // Note: In production, add access control
        // Update net OI (subtract the closing position)
        marketNetOI[marketId] -= sizeDelta;

        // Update total OI (subtract absolute value)
        uint256 absSize = MathLib.abs(sizeDelta);
        if (absSize > marketTotalOI[marketId]) {
            marketTotalOI[marketId] = 0;
        } else {
            marketTotalOI[marketId] -= absSize;
        }

        emit SkewUpdated(
            marketId,
            marketNetOI[marketId],
            marketTotalOI[marketId],
            getSkewRatio(marketId)
        );
    }

    /// @notice Lock rebate eligibility for a position (called at open)
    /// @param positionId Position identifier
    /// @param marketId Market identifier
    /// @param sizeDelta Size of position
    function lockRebateEligibility(
        bytes32 positionId,
        bytes32 marketId,
        int256 sizeDelta
    ) external {
        // Note: In production, add access control

        // Check eligibility at time of open
        int256 skewRatio = getSkewRatio(marketId);
        bool meetsThreshold = MathLib.abs(skewRatio) >= minSkewForIncentive;
        (bool balances, ) = wouldBalanceSkew(marketId, sizeDelta);

        bool eligible = meetsThreshold && balances;
        positionRebateEligible[positionId] = eligible;

        emit RebateEligibilityLocked(positionId, eligible);
    }

    /// @notice Clear rebate eligibility when position closes
    /// @param positionId Position identifier
    function clearRebateEligibility(bytes32 positionId) external {
        delete positionRebateEligible[positionId];
    }

    /// @notice Record rebate payment (for stats)
    /// @param positionId Position identifier
    /// @param trader Trader address
    /// @param amount Rebate amount
    function recordRebatePaid(bytes32 positionId, address trader, uint256 amount) external {
        totalRebatesPaid += amount;
        emit LossRebatePaid(positionId, trader, amount);
    }

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set loss rebate rate
    /// @param rate New rate (WAD)
    function setLossRebateRate(uint256 rate) external onlyOwner {
        if (rate > MAX_REBATE_RATE) revert InvalidRate();
        lossRebateRate = rate;
    }

    /// @notice Set positive slippage rate
    /// @param rate New rate (WAD)
    function setPositiveSlippageRate(uint256 rate) external onlyOwner {
        if (rate > MAX_POSITIVE_SLIPPAGE) revert InvalidRate();
        positiveSlippageRate = rate;
    }

    /// @notice Set minimum skew threshold for incentives
    /// @param threshold New threshold (WAD)
    function setMinSkewForIncentive(uint256 threshold) external onlyOwner {
        minSkewForIncentive = threshold;
    }
}
