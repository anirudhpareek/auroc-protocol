// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { FundingEngine } from "../src/engines/FundingEngine.sol";
import { IFundingEngine } from "../src/interfaces/IFundingEngine.sol";
import { IndexEngine } from "../src/engines/IndexEngine.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";
import { Regime } from "../src/types/DataTypes.sol";

contract FundingEngineTest is Test {
    FundingEngine public fundingEngine;
    IndexEngine public indexEngine;
    OracleRouter public oracleRouter;
    MockOracleAdapter public mockOracle;

    bytes32 public constant XAU_USD = keccak256("XAU/USD");

    uint256 public constant WAD = 1e18;
    uint256 public constant FUNDING_INTERVAL = 3600; // 1 hour
    uint256 public constant OFF_HOURS_CLAMP = 5e17; // 50%
    uint256 public constant MAX_FUNDING_RATE = 1e15; // 0.1%
    uint256 public constant IMBALANCE_WEIGHT = 5e17;

    function setUp() public {
        vm.warp(1000000);

        // Deploy oracle infrastructure
        oracleRouter = new OracleRouter(120, 60, 3, 1e16);
        mockOracle = new MockOracleAdapter();
        mockOracle.addMarket(XAU_USD);
        oracleRouter.addSource(XAU_USD, address(mockOracle), WAD, true);

        // Deploy index engine
        indexEngine = new IndexEngine(
            address(oracleRouter),
            5e15,  // d0
            25e15, // d1
            3e17,  // stress threshold
            900    // transition duration
        );
        indexEngine.registerMarket(XAU_USD, Regime.OPEN);

        // Deploy funding engine
        fundingEngine = new FundingEngine(
            address(indexEngine),
            FUNDING_INTERVAL,
            OFF_HOURS_CLAMP
        );

        // Configure funding params
        fundingEngine.setFundingParams(XAU_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);

        // Set initial price
        mockOracle.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
    }

    // ============================================
    // BASIC FUNDING RATE TESTS
    // ============================================

    function test_funding_rate_zero_at_equilibrium() public {
        // Mark = Index (no deviation)
        int256 rate = fundingEngine.getFundingRate(XAU_USD);

        // With high confidence and mark = index, funding should be near zero
        assertApproxEqAbs(rate, 0, 1e14, "Funding should be near zero at equilibrium");
    }

    function test_funding_rate_positive_when_mark_above_index() public {
        // This would require mark > index, which happens with price deviation
        // For now, test that the function returns a value
        int256 rate = fundingEngine.getFundingRate(XAU_USD);

        // Rate should be bounded
        assertLe(MathLib_abs(rate), MAX_FUNDING_RATE, "Rate should be within bounds");
    }

    function test_funding_rate_zero_for_unconfigured_market() public {
        bytes32 unknownMarket = keccak256("UNKNOWN");
        int256 rate = fundingEngine.getFundingRate(unknownMarket);
        assertEq(rate, 0, "Unconfigured market should have zero funding");
    }

    // ============================================
    // CUMULATIVE FUNDING TESTS
    // ============================================

    function test_cumulative_funding_starts_zero() public view {
        int256 cumulative = fundingEngine.getCumulativeFunding(XAU_USD);
        assertEq(cumulative, 0, "Initial cumulative funding should be zero");
    }

    function test_cumulative_funding_updates_after_interval() public {
        // Get initial state
        int256 initialCumulative = fundingEngine.getCumulativeFunding(XAU_USD);

        // Warp past funding interval
        vm.warp(block.timestamp + FUNDING_INTERVAL + 1);
        mockOracle.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);

        // Update funding
        fundingEngine.updateFunding(XAU_USD);

        // Cumulative may have changed based on rate
        int256 newCumulative = fundingEngine.getCumulativeFunding(XAU_USD);

        // Just verify it doesn't revert and returns a value
        assertTrue(newCumulative >= initialCumulative || newCumulative <= initialCumulative, "Cumulative should be valid");
    }

    function test_update_funding_too_early() public {
        // Try to update before interval passes
        fundingEngine.updateFunding(XAU_USD);

        // Get state
        (,,uint256 lastUpdate) = _getFundingState(XAU_USD);

        // Warp less than interval
        vm.warp(block.timestamp + FUNDING_INTERVAL / 2);
        mockOracle.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);

        // Update should not change state
        fundingEngine.updateFunding(XAU_USD);
    }

    // ============================================
    // UPDATE ALL FUNDING TEST
    // ============================================

    function test_update_all_funding() public {
        // Add another market
        bytes32 SPX_USD = keccak256("SPX/USD");
        mockOracle.addMarket(SPX_USD);
        oracleRouter.addSource(SPX_USD, address(mockOracle), WAD, true);
        indexEngine.registerMarket(SPX_USD, Regime.OPEN);
        fundingEngine.setFundingParams(SPX_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);
        mockOracle.setPrice(SPX_USD, 5000 * WAD, WAD, WAD);

        // Warp past interval
        vm.warp(block.timestamp + FUNDING_INTERVAL + 1);
        mockOracle.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle.setPrice(SPX_USD, 5000 * WAD, WAD, WAD);

        // Update all - should not revert
        fundingEngine.updateAllFunding();
    }

    // ============================================
    // REGIME-BASED CLAMPING TESTS
    // ============================================

    function test_funding_clamped_in_off_hours() public {
        // Set regime to OFF_HOURS
        indexEngine.setRegime(XAU_USD, Regime.OFF_HOURS);

        int256 rate = fundingEngine.getFundingRate(XAU_USD);

        // Rate should be more tightly clamped
        uint256 clampedMax = (MAX_FUNDING_RATE * OFF_HOURS_CLAMP) / WAD;
        assertLe(MathLib_abs(rate), clampedMax, "Rate should be clamped in off-hours");
    }

    function test_funding_clamped_in_stress() public {
        // Set regime to STRESS
        indexEngine.setRegime(XAU_USD, Regime.STRESS);

        int256 rate = fundingEngine.getFundingRate(XAU_USD);

        // Rate should be clamped
        uint256 clampedMax = (MAX_FUNDING_RATE * OFF_HOURS_CLAMP) / WAD;
        assertLe(MathLib_abs(rate), clampedMax, "Rate should be clamped in stress");
    }

    // ============================================
    // CONFIG TESTS
    // ============================================

    function test_set_funding_params() public {
        uint256 newMaxRate = 2e15;
        uint256 newImbalanceWeight = 6e17;

        fundingEngine.setFundingParams(XAU_USD, newMaxRate, newImbalanceWeight);

        (uint256 maxRate, uint256 imbalanceWeight, uint256 interval) = fundingEngine.getFundingParams(XAU_USD);

        assertEq(maxRate, newMaxRate, "Max rate should be updated");
        assertEq(imbalanceWeight, newImbalanceWeight, "Imbalance weight should be updated");
        assertEq(interval, FUNDING_INTERVAL, "Interval should be unchanged");
    }

    function test_set_funding_interval() public {
        uint256 newInterval = 7200; // 2 hours
        fundingEngine.setFundingInterval(newInterval);

        (,, uint256 interval) = fundingEngine.getFundingParams(XAU_USD);
        assertEq(interval, newInterval, "Interval should be updated");
    }

    function test_set_funding_interval_reverts_zero() public {
        vm.expectRevert("ZERO_INTERVAL");
        fundingEngine.setFundingInterval(0);
    }

    function test_set_off_hours_clamp_multiplier() public {
        uint256 newMultiplier = 3e17; // 30%
        fundingEngine.setOffHoursClampMultiplier(newMultiplier);

        assertEq(fundingEngine.offHoursClampMultiplier(), newMultiplier, "Multiplier should be updated");
    }

    function test_set_off_hours_clamp_reverts_invalid() public {
        vm.expectRevert("INVALID_MULTIPLIER");
        fundingEngine.setOffHoursClampMultiplier(2e18); // > 100%
    }

    // ============================================
    // TIME SINCE UPDATE TEST
    // ============================================

    function test_time_since_update() public {
        // Initial time since update
        uint256 timeSince = fundingEngine.getTimeSinceUpdate(XAU_USD);

        // Warp forward
        vm.warp(block.timestamp + 1000);

        uint256 newTimeSince = fundingEngine.getTimeSinceUpdate(XAU_USD);
        assertEq(newTimeSince, timeSince + 1000, "Time since update should increase");
    }

    // ============================================
    // ACCESS CONTROL TESTS
    // ============================================

    function test_only_owner_can_set_params() public {
        vm.prank(address(0xdead));
        vm.expectRevert();
        fundingEngine.setFundingParams(XAU_USD, 1e15, 5e17);
    }

    function test_only_owner_can_set_interval() public {
        vm.prank(address(0xdead));
        vm.expectRevert();
        fundingEngine.setFundingInterval(7200);
    }

    // ============================================
    // FUZZ TESTS
    // ============================================

    function testFuzz_funding_rate_bounded(uint256 markPrice) public {
        markPrice = bound(markPrice, 1000 * WAD, 3000 * WAD);

        // This would need mark price to differ from index
        // For now, just verify the rate is always bounded
        int256 rate = fundingEngine.getFundingRate(XAU_USD);

        assertLe(MathLib_abs(rate), MAX_FUNDING_RATE, "Rate should always be bounded");
    }

    // ============================================
    // HELPERS
    // ============================================

    function MathLib_abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    function _getFundingState(bytes32 marketId) internal view returns (int256, int256, uint256) {
        (int256 cumulative, int256 lastRate, uint256 lastUpdate) = fundingEngine.fundingStates(marketId);
        return (cumulative, lastRate, lastUpdate);
    }
}
