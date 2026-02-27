// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { SkewManager } from "../src/engines/SkewManager.sol";

contract SkewManagerTest is Test {
    SkewManager public skewManager;

    bytes32 public constant XAU_USD = keccak256("XAU/USD");

    uint256 public constant WAD = 1e18;
    uint256 public constant LOSS_REBATE_RATE = 1e17; // 10%
    uint256 public constant POSITIVE_SLIPPAGE_RATE = 3e15; // 0.3%
    uint256 public constant MIN_SKEW_FOR_INCENTIVE = 1e17; // 10%

    function setUp() public {
        skewManager = new SkewManager(
            LOSS_REBATE_RATE,
            POSITIVE_SLIPPAGE_RATE,
            MIN_SKEW_FOR_INCENTIVE
        );
    }

    // ============================================
    // SKEW RATIO TESTS
    // ============================================

    function test_skew_ratio_zero_initially() public view {
        int256 skew = skewManager.getSkewRatio(XAU_USD);
        assertEq(skew, 0, "Initial skew should be zero");
    }

    function test_skew_ratio_positive_more_longs() public {
        // Add long positions
        skewManager.updateOI(XAU_USD, 100e18); // 100 long
        skewManager.updateOI(XAU_USD, 50e18);  // 50 more long

        int256 skew = skewManager.getSkewRatio(XAU_USD);
        assertEq(skew, int256(WAD), "100% long skew expected");
    }

    function test_skew_ratio_negative_more_shorts() public {
        // Add short positions
        skewManager.updateOI(XAU_USD, -100e18); // 100 short
        skewManager.updateOI(XAU_USD, -50e18);  // 50 more short

        int256 skew = skewManager.getSkewRatio(XAU_USD);
        assertEq(skew, -int256(WAD), "100% short skew expected");
    }

    function test_skew_ratio_balanced() public {
        // Equal longs and shorts
        skewManager.updateOI(XAU_USD, 100e18);  // 100 long
        skewManager.updateOI(XAU_USD, -100e18); // 100 short

        int256 skew = skewManager.getSkewRatio(XAU_USD);
        assertEq(skew, 0, "Balanced OI should have zero skew");
    }

    // ============================================
    // WOULD BALANCE SKEW TESTS
    // ============================================

    function test_would_balance_skew_short_reduces_long_skew() public {
        // Create long-heavy skew
        skewManager.updateOI(XAU_USD, 100e18); // 100 long

        // Short trade should balance
        (bool balances, uint256 reduction) = skewManager.wouldBalanceSkew(XAU_USD, -50e18);

        assertTrue(balances, "Short should balance long-heavy market");
        assertEq(reduction, 50e18, "Reduction should equal trade size");
    }

    function test_would_balance_skew_long_reduces_short_skew() public {
        // Create short-heavy skew
        skewManager.updateOI(XAU_USD, -100e18); // 100 short

        // Long trade should balance
        (bool balances, uint256 reduction) = skewManager.wouldBalanceSkew(XAU_USD, 50e18);

        assertTrue(balances, "Long should balance short-heavy market");
        assertEq(reduction, 50e18, "Reduction should equal trade size");
    }

    function test_would_not_balance_same_direction() public {
        // Create long-heavy skew
        skewManager.updateOI(XAU_USD, 100e18);

        // More longs don't balance
        (bool balances,) = skewManager.wouldBalanceSkew(XAU_USD, 50e18);

        assertFalse(balances, "Same direction should not balance");
    }

    // ============================================
    // POSITIVE SLIPPAGE TESTS
    // ============================================

    function test_positive_slippage_zero_when_balanced() public view {
        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, 50e18);
        assertEq(slippage, 0, "No slippage reward when balanced");
    }

    function test_positive_slippage_zero_when_skew_below_threshold() public {
        // Small skew below threshold
        skewManager.updateOI(XAU_USD, 50e18);  // long
        skewManager.updateOI(XAU_USD, -45e18); // short (5% skew)

        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, -5e18);
        assertEq(slippage, 0, "No reward when skew below threshold");
    }

    function test_positive_slippage_awarded_for_balancing() public {
        // Create significant skew (100% long)
        skewManager.updateOI(XAU_USD, 100e18);

        // Calculate slippage for balancing trade
        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, -50e18);

        assertGt(slippage, 0, "Should receive positive slippage");
        assertLe(slippage, skewManager.MAX_POSITIVE_SLIPPAGE(), "Should not exceed max");
    }

    function test_positive_slippage_capped_at_max() public {
        // Create very large skew
        skewManager.updateOI(XAU_USD, 1000e18);

        // Large balancing trade
        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, -1000e18);

        assertLe(slippage, skewManager.MAX_POSITIVE_SLIPPAGE(), "Slippage should be capped");
    }

    // ============================================
    // LOSS REBATE TESTS
    // ============================================

    function test_loss_rebate_zero_when_not_eligible() public view {
        bytes32 positionId = keccak256("position1");

        uint256 rebate = skewManager.calculateLossRebate(positionId, 100e18);
        assertEq(rebate, 0, "Non-eligible position gets no rebate");
    }

    function test_loss_rebate_awarded_when_eligible() public {
        bytes32 positionId = keccak256("position1");

        // Create skewed market and lock eligibility
        skewManager.updateOI(XAU_USD, 100e18); // Long heavy
        skewManager.lockRebateEligibility(positionId, XAU_USD, -50e18); // Short = balancing

        // Calculate rebate
        uint256 loss = 1000e18;
        uint256 rebate = skewManager.calculateLossRebate(positionId, loss);

        uint256 expectedRebate = (loss * LOSS_REBATE_RATE) / WAD;
        assertEq(rebate, expectedRebate, "Rebate should match rate");
    }

    // ============================================
    // REBATE ELIGIBILITY TESTS
    // ============================================

    function test_rebate_eligibility_locked_at_open() public {
        bytes32 positionId = keccak256("position1");

        // Create skewed market
        skewManager.updateOI(XAU_USD, 100e18);

        // Lock eligibility for balancing trade
        skewManager.lockRebateEligibility(positionId, XAU_USD, -50e18);

        assertTrue(skewManager.positionRebateEligible(positionId), "Should be eligible");
    }

    function test_rebate_eligibility_not_locked_when_not_balancing() public {
        bytes32 positionId = keccak256("position1");

        // Create skewed market
        skewManager.updateOI(XAU_USD, 100e18);

        // Try to lock eligibility for non-balancing trade
        skewManager.lockRebateEligibility(positionId, XAU_USD, 50e18); // Same direction

        assertFalse(skewManager.positionRebateEligible(positionId), "Should not be eligible");
    }

    function test_rebate_eligibility_cleared_on_close() public {
        bytes32 positionId = keccak256("position1");

        // Create eligibility
        skewManager.updateOI(XAU_USD, 100e18);
        skewManager.lockRebateEligibility(positionId, XAU_USD, -50e18);

        assertTrue(skewManager.positionRebateEligible(positionId), "Should be eligible before clear");

        // Clear eligibility
        skewManager.clearRebateEligibility(positionId);

        assertFalse(skewManager.positionRebateEligible(positionId), "Should not be eligible after clear");
    }

    function test_check_rebate_eligibility() public {
        // Create significant skew
        skewManager.updateOI(XAU_USD, 100e18);

        bool eligible = skewManager.checkRebateEligibility(XAU_USD, -50e18);
        assertTrue(eligible, "Balancing trade should be eligible");

        bool notEligible = skewManager.checkRebateEligibility(XAU_USD, 50e18);
        assertFalse(notEligible, "Non-balancing trade should not be eligible");
    }

    // ============================================
    // OI UPDATE TESTS
    // ============================================

    function test_update_oi_increases_tracking() public {
        skewManager.updateOI(XAU_USD, 100e18);

        assertEq(skewManager.marketNetOI(XAU_USD), 100e18, "Net OI should be 100");
        assertEq(skewManager.marketTotalOI(XAU_USD), 100e18, "Total OI should be 100");
    }

    function test_close_oi_decreases_tracking() public {
        // Open position
        skewManager.updateOI(XAU_USD, 100e18);

        // Close position
        skewManager.closeOI(XAU_USD, 100e18);

        assertEq(skewManager.marketNetOI(XAU_USD), 0, "Net OI should be 0");
        assertEq(skewManager.marketTotalOI(XAU_USD), 0, "Total OI should be 0");
    }

    function test_close_oi_handles_underflow() public {
        // Close without open (should not underflow)
        skewManager.closeOI(XAU_USD, 100e18);

        assertEq(skewManager.marketTotalOI(XAU_USD), 0, "Total OI should be 0, not underflow");
    }

    // ============================================
    // RECORD REBATE PAID TESTS
    // ============================================

    function test_record_rebate_paid() public {
        bytes32 positionId = keccak256("position1");
        address trader = address(0x1);
        uint256 amount = 100e18;

        uint256 totalBefore = skewManager.totalRebatesPaid();

        skewManager.recordRebatePaid(positionId, trader, amount);

        assertEq(skewManager.totalRebatesPaid(), totalBefore + amount, "Total should increase");
    }

    // ============================================
    // CONFIG TESTS
    // ============================================

    function test_set_loss_rebate_rate() public {
        uint256 newRate = 2e17; // 20%
        skewManager.setLossRebateRate(newRate);

        assertEq(skewManager.lossRebateRate(), newRate, "Rate should be updated");
    }

    function test_set_loss_rebate_rate_reverts_exceeds_max() public {
        vm.expectRevert(SkewManager.InvalidRate.selector);
        skewManager.setLossRebateRate(4e17); // 40% > 30% max
    }

    function test_set_positive_slippage_rate() public {
        uint256 newRate = 4e15; // 0.4%
        skewManager.setPositiveSlippageRate(newRate);

        assertEq(skewManager.positiveSlippageRate(), newRate, "Rate should be updated");
    }

    function test_set_positive_slippage_rate_reverts_exceeds_max() public {
        vm.expectRevert(SkewManager.InvalidRate.selector);
        skewManager.setPositiveSlippageRate(1e16); // 1% > 0.5% max
    }

    function test_set_min_skew_for_incentive() public {
        uint256 newThreshold = 2e17; // 20%
        skewManager.setMinSkewForIncentive(newThreshold);

        assertEq(skewManager.minSkewForIncentive(), newThreshold, "Threshold should be updated");
    }

    // ============================================
    // ACCESS CONTROL TESTS
    // ============================================

    function test_only_owner_can_set_rates() public {
        vm.prank(address(0xdead));
        vm.expectRevert();
        skewManager.setLossRebateRate(1e17);
    }

    // ============================================
    // FUZZ TESTS
    // ============================================

    function testFuzz_skew_ratio_bounded(int256 longOI, int256 shortOI) public {
        longOI = bound(longOI, 1e18, 1000000e18);
        shortOI = bound(shortOI, -1000000e18, -1e18);

        skewManager.updateOI(XAU_USD, longOI);
        skewManager.updateOI(XAU_USD, shortOI);

        int256 skew = skewManager.getSkewRatio(XAU_USD);

        // Skew should be in [-1, 1] range (WAD)
        assertGe(skew, -int256(WAD), "Skew should be >= -1");
        assertLe(skew, int256(WAD), "Skew should be <= 1");
    }

    function testFuzz_positive_slippage_capped(uint256 oiSize, uint256 tradeSize) public {
        oiSize = bound(oiSize, 100e18, 1000000e18);
        tradeSize = bound(tradeSize, 1e18, oiSize);

        // Create skewed market
        skewManager.updateOI(XAU_USD, int256(oiSize));

        // Calculate slippage for balancing trade
        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, -int256(tradeSize));

        assertLe(slippage, skewManager.MAX_POSITIVE_SLIPPAGE(), "Slippage always capped");
    }
}
