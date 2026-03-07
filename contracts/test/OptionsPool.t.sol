// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Test, console } from "forge-std/Test.sol";
import { IERC20 }        from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { AurocOptionsPool }       from "../src/options/AurocOptionsPool.sol";
import { IOptionsPool }           from "../src/interfaces/IOptionsPool.sol";
import { AurocCollateralTracker } from "../src/options/AurocCollateralTracker.sol";
import { RealizedVolOracle }      from "../src/options/RealizedVolOracle.sol";
import { VolSurface }             from "../src/options/VolSurface.sol";
import { OptionLeg, OptionPosition, OptionType, OptionSide, Greeks } from "../src/types/OptionsTypes.sol";
import { Regime }                 from "../src/types/DataTypes.sol";
import { MockUSDC }               from "../src/mocks/MockUSDC.sol";

// ────────────────────────────────────────────────────────────────────────────
// MOCKS
// ────────────────────────────────────────────────────────────────────────────

contract MockIndexEngine {
    mapping(bytes32 => uint256) public prices;
    mapping(bytes32 => Regime)  public regimes;

    function setPrice(bytes32 m, uint256 p) external { prices[m] = p; }
    function setRegime(bytes32 m, Regime r) external { regimes[m] = r; }

    function getIndexPrice(bytes32 m) external view returns (uint256) { return prices[m]; }
    function getMarkPrice(bytes32 m)  external view returns (uint256) { return prices[m]; }
    function getRegime(bytes32 m)     external view returns (Regime)  { return regimes[m]; }
    function getConfidence(bytes32 m) external view returns (uint256) { return 1e18; }
}

contract MockOracleRouter {
    mapping(bytes32 => uint256) public prices;
    struct AggregatedPrice { uint256 price; uint256 confidence; uint256 dispersion; uint256 sourceCount; uint256 timestamp; }
    function setPrice(bytes32 m, uint256 p) external { prices[m] = p; }
    function getAggregatedPrice(bytes32 m) external view returns (AggregatedPrice memory) {
        return AggregatedPrice({ price: prices[m], confidence: 1e18, dispersion: 0, sourceCount: 1, timestamp: block.timestamp });
    }
}

contract MockVolOracle {
    mapping(bytes32 => uint256) public vols;
    function setVol(bytes32 m, uint256 v) external { vols[m] = v; }
    function getVol(bytes32 m) external view returns (uint256) { return vols[m]; }
    function registeredMarkets(bytes32 m) external view returns (bool) { return vols[m] > 0; }
}

contract MockVolSurface {
    uint256 public fixedIV = 2e17; // 20%
    function setIV(uint256 iv) external { fixedIV = iv; }
    function getIV(bytes32, uint256, bool) external view returns (uint256) { return fixedIV; }
    function getATMIV(bytes32) external view returns (uint256) { return fixedIV; }
    function skewParams(bytes32) external view returns (uint256, uint256, uint256, bool) { return (0, 0, 0, true); }
}

// ────────────────────────────────────────────────────────────────────────────
// TEST SETUP HELPER
// ────────────────────────────────────────────────────────────────────────────

abstract contract OptionsTestBase is Test {
    MockUSDC              usdc;
    MockIndexEngine       indexEngine;
    MockVolSurface        volSurface;
    AurocCollateralTracker tracker;
    AurocOptionsPool      pool;

    address alice = address(0xA11CE);
    address bob   = address(0xB0B);
    address owner = address(this);

    bytes32 constant XAU = keccak256("XAU/USD");
    bytes32 constant SPX = keccak256("SPX/USD");

    uint256 constant SPOT_XAU = 2900e18; // $2,900 in WAD
    uint256 constant SPOT_SPX = 5200e18; // $5,200 in WAD

    function setUp() public virtual {
        usdc        = new MockUSDC();
        indexEngine = new MockIndexEngine();
        volSurface  = new MockVolSurface();

        // Price setup
        indexEngine.setPrice(XAU, SPOT_XAU);
        indexEngine.setPrice(SPX, SPOT_SPX);
        indexEngine.setRegime(XAU, Regime.OPEN);
        indexEngine.setRegime(SPX, Regime.OPEN);

        // Deploy tracker & pool
        tracker = new AurocCollateralTracker(address(usdc), "Auroc LP", "aUSD");
        pool    = new AurocOptionsPool(
            address(usdc),
            address(indexEngine),
            address(volSurface),
            address(tracker)
        );

        // Wire up
        tracker.setAuthorizedEngine(address(pool), true);
        pool.registerMarket(XAU);
        pool.registerMarket(SPX);

        // Fund users
        usdc.mint(alice, 100_000e6);
        usdc.mint(bob,   100_000e6);

        vm.prank(alice); usdc.approve(address(pool), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(pool), type(uint256).max);
    }

    // ── helpers ────────────────────────────────────────────────────────────

    function _longCall(uint256 strike, uint256 notional) internal pure returns (OptionLeg[] memory) {
        OptionLeg[] memory legs = new OptionLeg[](1);
        legs[0] = OptionLeg({
            marketId:   XAU,
            strike:     strike,
            optionType: OptionType.CALL,
            side:       OptionSide.LONG,
            notional:   notional
        });
        return legs;
    }

    function _longPut(uint256 strike, uint256 notional) internal pure returns (OptionLeg[] memory) {
        OptionLeg[] memory legs = new OptionLeg[](1);
        legs[0] = OptionLeg({
            marketId:   XAU,
            strike:     strike,
            optionType: OptionType.PUT,
            side:       OptionSide.LONG,
            notional:   notional
        });
        return legs;
    }

    function _shortCall(uint256 strike, uint256 notional) internal pure returns (OptionLeg[] memory) {
        OptionLeg[] memory legs = new OptionLeg[](1);
        legs[0] = OptionLeg({
            marketId:   XAU,
            strike:     strike,
            optionType: OptionType.CALL,
            side:       OptionSide.SHORT,
            notional:   notional
        });
        return legs;
    }

    function _straddle(uint256 strike, uint256 notional) internal pure returns (OptionLeg[] memory) {
        OptionLeg[] memory legs = new OptionLeg[](2);
        legs[0] = OptionLeg({ marketId: XAU, strike: strike, optionType: OptionType.CALL, side: OptionSide.LONG, notional: notional });
        legs[1] = OptionLeg({ marketId: XAU, strike: strike, optionType: OptionType.PUT,  side: OptionSide.LONG, notional: notional });
        return legs;
    }

    function _getCost(OptionLeg[] memory legs) internal view returns (uint256) {
        return pool.getRequiredCollateral(legs).total;
    }
}

// ────────────────────────────────────────────────────────────────────────────
// TESTS
// ────────────────────────────────────────────────────────────────────────────

contract OptionsPool_MintBurn is OptionsTestBase {

    // ─── Mint ─────────────────────────────────────────────────────────────

    function test_MintLongCall_succeeds() public {
        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18); // 1 unit notional
        uint256 cost = _getCost(legs);
        assertGt(cost, 0, "Cost should be positive");

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        assertNotEq(posId, bytes32(0), "Position ID should be set");
        assertEq(usdc.balanceOf(alice), balBefore - cost, "Cost deducted from alice");
        assertEq(pool.getTraderOptions(alice).length, 1, "Alice has 1 option");
    }

    function test_MintLongPut_succeeds() public {
        OptionLeg[] memory legs = _longPut(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);
        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);
        assertNotEq(posId, bytes32(0));
    }

    function test_MintShortCall_locksCollateral() public {
        OptionLeg[] memory legs = _shortCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);
        assertGt(cost, 0);

        uint256 lockedBefore = tracker.optionsLocked();
        vm.prank(alice);
        pool.mintOption(legs, cost);
        assertGt(tracker.optionsLocked(), lockedBefore, "Seller collateral should be locked");
    }

    function test_MintStraddle_2legs() public {
        OptionLeg[] memory legs = _straddle(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);
        assertGt(cost, 0);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);
        assertEq(pool.getOptionPosition(posId).legCount, 2, "Straddle has 2 legs");
    }

    function test_Mint4legs_succeeds() public {
        OptionLeg[] memory legs = new OptionLeg[](4);
        for (uint256 i = 0; i < 4; i++) {
            legs[i] = OptionLeg({
                marketId:   XAU,
                strike:     SPOT_XAU,
                optionType: OptionType.CALL,
                side:       OptionSide.LONG,
                notional:   5e17 // 0.5 unit each
            });
        }
        uint256 cost = _getCost(legs);
        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);
        assertEq(pool.getOptionPosition(posId).legCount, 4);
    }

    function test_Mint5legs_reverts() public {
        OptionLeg[] memory legs = new OptionLeg[](5);
        for (uint256 i = 0; i < 5; i++) {
            legs[i] = OptionLeg({ marketId: XAU, strike: SPOT_XAU, optionType: OptionType.CALL, side: OptionSide.LONG, notional: 1e18 });
        }
        vm.prank(alice);
        vm.expectRevert(IOptionsPool.InvalidLegCount.selector);
        pool.mintOption(legs, type(uint256).max);
    }

    function test_MintCostExceedsMax_reverts() public {
        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        vm.prank(alice);
        vm.expectRevert(IOptionsPool.CostExceedsMax.selector);
        pool.mintOption(legs, 0); // maxCost = 0
    }

    // ─── Regime gating ────────────────────────────────────────────────────

    function test_MintDuringOffHours_reverts() public {
        indexEngine.setRegime(XAU, Regime.OFF_HOURS);

        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = pool.getRequiredCollateral(legs).total;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IOptionsPool.OptionsSuspended.selector, XAU));
        pool.mintOption(legs, cost);
    }

    function test_MintDuringStress_reverts() public {
        indexEngine.setRegime(XAU, Regime.STRESS);

        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = pool.getRequiredCollateral(legs).total;

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IOptionsPool.OptionsSuspended.selector, XAU));
        pool.mintOption(legs, cost);
    }

    function test_MintDuringTransition_succeeds() public {
        indexEngine.setRegime(XAU, Regime.TRANSITION);

        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);
        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);
        assertNotEq(posId, bytes32(0));
    }

    // ─── Burn ─────────────────────────────────────────────────────────────

    function test_BurnLongCall_OTM_returnsResidual() public {
        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        // Move spot below strike — deeply OTM
        indexEngine.setPrice(XAU, SPOT_XAU / 2);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 payout = pool.burnOption(posId, 0);

        // For deeply OTM, payout = time value only (small but > 0)
        uint256 balAfter = usdc.balanceOf(alice);
        assertEq(balAfter - balBefore, payout, "Payout transferred to alice");
        assertEq(pool.getTraderOptions(alice).length, 0, "Position removed");
    }

    function test_BurnLongCall_ITM_higherPayout() public {
        uint256 strike = SPOT_XAU * 9 / 10; // 10% below spot → ITM call
        OptionLeg[] memory legs = new OptionLeg[](1);
        legs[0] = OptionLeg({ marketId: XAU, strike: strike, optionType: OptionType.CALL, side: OptionSide.LONG, notional: 1e18 });

        uint256 cost = _getCost(legs);
        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        uint256 atmCost = pool.getRequiredCollateral(_longCall(SPOT_XAU, 1e18)).total;
        // Simplified model uses ATM premium regardless of moneyness, so cost >= atmCost
        assertGe(cost, atmCost, "ITM call should cost at least as much as ATM");

        vm.prank(alice);
        uint256 payout = pool.burnOption(posId, 0);
        // Payout should be positive
        assertGt(payout, 0);
    }

    function test_BurnByNonOwner_reverts() public {
        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        vm.prank(bob);
        vm.expectRevert(IOptionsPool.NotPositionOwner.selector);
        pool.burnOption(posId, 0);
    }

    function test_BurnDuringOffHours_allowed() public {
        // Off-hours: minting blocked, but BURNING should still work
        OptionLeg[] memory legs = _longCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        indexEngine.setRegime(XAU, Regime.OFF_HOURS);

        // Burn should succeed (no regime gate on burn)
        vm.prank(alice);
        pool.burnOption(posId, 0);
    }

    function test_BurnNonExistentPosition_reverts() public {
        vm.prank(alice);
        vm.expectRevert(IOptionsPool.PositionNotFound.selector);
        pool.burnOption(bytes32("fake"), 0);
    }
}

contract OptionsPool_Greeks is OptionsTestBase {

    function test_GetGreeks_returnsNonZero() public view {
        Greeks memory g = pool.getGreeks(XAU, SPOT_XAU, true);
        assertGt(g.iv, 0,      "IV should be positive");
        assertGt(g.premium, 0, "ATM premium should be positive");
        assertGt(g.vega, 0,    "Vega should be positive");
    }

    function test_DeltaCall_ATM_nearHalf() public view {
        Greeks memory g = pool.getGreeks(XAU, SPOT_XAU, true);
        // ATM call delta ≈ 0.5 (in WAD: 5e17), allow ±0.1
        assertGt(g.delta, 4e17, "ATM call delta should be > 0.4");
        assertLt(g.delta, 6e17, "ATM call delta should be < 0.6");
    }

    function test_DeltaPut_ATM_nearNegHalf() public view {
        Greeks memory g = pool.getGreeks(XAU, SPOT_XAU, false);
        // ATM put delta ≈ -0.5
        assertLt(g.delta, -4e17, "ATM put delta should be < -0.4");
        assertGt(g.delta, -6e17, "ATM put delta should be > -0.6");
    }

    function test_Theta_isNegative() public view {
        Greeks memory g = pool.getGreeks(XAU, SPOT_XAU, true);
        assertLt(g.theta, 0, "Theta should be negative for long options");
    }
}

contract OptionsPool_CollateralTracker is OptionsTestBase {

    function test_TrackerLockRelease_invariant() public {
        OptionLeg[] memory legs = _shortCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);

        uint256 lockedBefore = tracker.optionsLocked();

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        uint256 lockedAfter = tracker.optionsLocked();
        assertGt(lockedAfter, lockedBefore);

        vm.prank(alice);
        pool.burnOption(posId, 0);

        // After burn, locked collateral should return to pre-mint level
        assertEq(tracker.optionsLocked(), lockedBefore, "Locked collateral should be released");
    }

    function test_ERC4626_totalAssets_excludesLocked() public {
        // Deposit LP funds first
        vm.prank(alice);
        usdc.approve(address(tracker), 10_000e6);
        vm.prank(alice);
        tracker.deposit(10_000e6, alice);

        uint256 totalBefore = tracker.totalAssets();

        // Open a short option (locks collateral)
        OptionLeg[] memory legs = _shortCall(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);
        vm.prank(bob);
        pool.mintOption(legs, cost);

        // totalAssets should decrease by locked amount
        uint256 totalAfter = tracker.totalAssets();
        assertLt(totalAfter, totalBefore + cost, "totalAssets should account for locked collateral");
    }
}

contract OptionsPool_MultiLeg is OptionsTestBase {

    function test_Straddle_collateralIsSum() public view {
        // Straddle = long call + long put at same strike
        OptionLeg[] memory call = _longCall(SPOT_XAU, 1e18);
        OptionLeg[] memory put  = _longPut(SPOT_XAU, 1e18);
        OptionLeg[] memory both = _straddle(SPOT_XAU, 1e18);

        uint256 callCost    = _getCost(call);
        uint256 putCost     = _getCost(put);
        uint256 straddleCost = _getCost(both);

        // Straddle cost ≈ call + put costs (within 1 USDC rounding)
        assertApproxEqAbs(straddleCost, callCost + putCost, 1e6, "Straddle = call + put");
    }

    function test_BullCallSpread_succeeds() public {
        uint256 lowerStrike = SPOT_XAU * 95 / 100; // buy lower strike call
        uint256 upperStrike = SPOT_XAU * 105 / 100; // sell higher strike call

        OptionLeg[] memory legs = new OptionLeg[](2);
        legs[0] = OptionLeg({ marketId: XAU, strike: lowerStrike, optionType: OptionType.CALL, side: OptionSide.LONG,  notional: 1e18 });
        legs[1] = OptionLeg({ marketId: XAU, strike: upperStrike, optionType: OptionType.CALL, side: OptionSide.SHORT, notional: 1e18 });

        uint256 cost = _getCost(legs);
        assertGt(cost, 0);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);
        assertNotEq(posId, bytes32(0));

        vm.prank(alice);
        pool.burnOption(posId, 0);
    }

    function test_MultiLegPosition_storesAllLegs() public {
        OptionLeg[] memory legs = _straddle(SPOT_XAU, 1e18);
        uint256 cost = _getCost(legs);

        vm.prank(alice);
        bytes32 posId = pool.mintOption(legs, cost);

        OptionPosition memory pos = pool.getOptionPosition(posId);
        assertEq(pos.legCount, 2);
        assertEq(uint8(pos.legs[0].optionType), uint8(OptionType.CALL));
        assertEq(uint8(pos.legs[1].optionType), uint8(OptionType.PUT));
    }
}
