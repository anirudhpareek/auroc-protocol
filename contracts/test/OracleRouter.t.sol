// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";
import { AggregatedPrice, OraclePrice } from "../src/types/DataTypes.sol";

contract OracleRouterTest is Test {
    OracleRouter public router;
    MockOracleAdapter public mockOracle1;
    MockOracleAdapter public mockOracle2;
    MockOracleAdapter public mockOracle3;

    bytes32 public constant XAU_USD = keccak256("XAU/USD");
    bytes32 public constant SPX_USD = keccak256("SPX/USD");

    uint256 public constant WAD = 1e18;
    uint256 public constant MAX_STALENESS = 120; // 2 minutes
    uint256 public constant TAU_DECAY = 60;
    uint256 public constant TARGET_SOURCES = 3;
    uint256 public constant S0_DISPERSION = 1e16; // 1%

    function setUp() public {
        // Deploy router
        router = new OracleRouter(MAX_STALENESS, TAU_DECAY, TARGET_SOURCES, S0_DISPERSION);

        // Deploy mock oracles
        mockOracle1 = new MockOracleAdapter();
        mockOracle2 = new MockOracleAdapter();
        mockOracle3 = new MockOracleAdapter();

        // Add XAU/USD market to all oracles
        mockOracle1.addMarket(XAU_USD);
        mockOracle2.addMarket(XAU_USD);
        mockOracle3.addMarket(XAU_USD);

        // Add sources to router
        router.addSource(XAU_USD, address(mockOracle1), WAD, true); // Primary
        router.addSource(XAU_USD, address(mockOracle2), WAD, false);
        router.addSource(XAU_USD, address(mockOracle3), WAD, false);
    }

    // ============================================
    // SINGLE SOURCE TESTS
    // ============================================

    function test_aggregation_single_source() public {
        // Set up with only one source
        bytes32 testMarket = keccak256("TEST");
        MockOracleAdapter singleOracle = new MockOracleAdapter();
        singleOracle.addMarket(testMarket);
        router.addSource(testMarket, address(singleOracle), WAD, true);

        uint256 price = 2000 * WAD; // $2000
        singleOracle.setPrice(testMarket, price, WAD, WAD);

        AggregatedPrice memory agg = router.getAggregatedPrice(testMarket);

        assertEq(agg.price, price, "Single source should return exact price");
        assertEq(agg.sourceCount, 1, "Should have 1 source");
        assertGt(agg.confidence, 0, "Should have some confidence");
    }

    // ============================================
    // MULTIPLE SOURCE TESTS
    // ============================================

    function test_aggregation_multiple_sources_same_price() public {
        uint256 price = 2000 * WAD;

        mockOracle1.setPrice(XAU_USD, price, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, price, WAD, WAD);
        mockOracle3.setPrice(XAU_USD, price, WAD, WAD);

        AggregatedPrice memory agg = router.getAggregatedPrice(XAU_USD);

        // With same prices, result should be very close to input
        assertApproxEqRel(agg.price, price, 1e15, "Should aggregate to same price");
        assertEq(agg.sourceCount, 3, "Should have 3 sources");
        assertEq(agg.dispersion, 0, "No dispersion with identical prices");
        assertGt(agg.confidence, 9e17, "High confidence with good sources"); // > 90%
    }

    function test_aggregation_multiple_sources_varying_prices() public {
        // Small variance in prices
        mockOracle1.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, 2010 * WAD, WAD, WAD); // +0.5%
        mockOracle3.setPrice(XAU_USD, 1990 * WAD, WAD, WAD); // -0.5%

        AggregatedPrice memory agg = router.getAggregatedPrice(XAU_USD);

        // Should be close to average
        assertApproxEqRel(agg.price, 2000 * WAD, 1e16, "Should be close to mean");
        assertGt(agg.dispersion, 0, "Should have some dispersion");
    }

    // ============================================
    // STALE PRICE TESTS
    // ============================================

    function test_stale_filtering() public {
        // Set two fresh prices and one stale
        uint256 freshPrice = 2000 * WAD;
        uint256 stalePrice = 1900 * WAD;

        mockOracle1.setPrice(XAU_USD, freshPrice, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, freshPrice, WAD, WAD);

        // Set stale price with old timestamp
        mockOracle3.setPriceWithTimestamp(
            XAU_USD,
            stalePrice,
            WAD,
            WAD,
            block.timestamp - MAX_STALENESS - 1
        );

        AggregatedPrice memory agg = router.getAggregatedPrice(XAU_USD);

        // Should only use 2 sources, not the stale one
        assertEq(agg.sourceCount, 2, "Should filter stale source");
        assertApproxEqRel(agg.price, freshPrice, 1e15, "Should ignore stale price");
    }

    function test_revert_no_valid_sources() public {
        bytes32 emptyMarket = keccak256("EMPTY");

        vm.expectRevert(OracleRouter.NoValidSources.selector);
        router.getAggregatedPrice(emptyMarket);
    }

    // ============================================
    // CONFIDENCE TESTS
    // ============================================

    function test_confidence_age_component() public {
        // Fresh price should have high C_age
        mockOracle1.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle3.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);

        AggregatedPrice memory freshAgg = router.getAggregatedPrice(XAU_USD);

        // Set older prices (but not stale)
        uint256 halfStale = MAX_STALENESS / 2;
        mockOracle1.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - halfStale);
        mockOracle2.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - halfStale);
        mockOracle3.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - halfStale);

        AggregatedPrice memory olderAgg = router.getAggregatedPrice(XAU_USD);

        assertGt(freshAgg.confidence, olderAgg.confidence, "Fresh prices should have higher confidence");
    }

    function test_confidence_dispersion_component() public {
        // Low dispersion = high confidence
        mockOracle1.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle3.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);

        AggregatedPrice memory lowDispAgg = router.getAggregatedPrice(XAU_USD);

        // High dispersion = lower confidence
        mockOracle1.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, 2100 * WAD, WAD, WAD); // +5%
        mockOracle3.setPrice(XAU_USD, 1900 * WAD, WAD, WAD); // -5%

        AggregatedPrice memory highDispAgg = router.getAggregatedPrice(XAU_USD);

        assertGt(lowDispAgg.confidence, highDispAgg.confidence, "Low dispersion should have higher confidence");
    }

    function test_confidence_source_component() public {
        // 3 sources = full C_src
        mockOracle1.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);
        mockOracle3.setPrice(XAU_USD, 2000 * WAD, WAD, WAD);

        AggregatedPrice memory threeSourceAgg = router.getAggregatedPrice(XAU_USD);

        // Remove one source
        router.removeSource(XAU_USD, address(mockOracle3));

        AggregatedPrice memory twoSourceAgg = router.getAggregatedPrice(XAU_USD);

        assertGt(threeSourceAgg.confidence, twoSourceAgg.confidence, "More sources should have higher confidence");

        // Restore
        router.addSource(XAU_USD, address(mockOracle3), WAD, false);
    }

    // ============================================
    // PRIMARY PRICE TESTS
    // ============================================

    function test_primary_price() public {
        uint256 primaryPrice = 2000 * WAD;
        mockOracle1.setPrice(XAU_USD, primaryPrice, WAD, WAD);

        (uint256 price, uint256 timestamp) = router.getPrimaryPrice(XAU_USD);

        assertEq(price, primaryPrice, "Should return primary price");
        assertEq(timestamp, block.timestamp, "Should return current timestamp");
    }

    function test_primary_price_stale_reverts() public {
        mockOracle1.setPriceWithTimestamp(
            XAU_USD,
            2000 * WAD,
            WAD,
            WAD,
            block.timestamp - MAX_STALENESS - 1
        );

        vm.expectRevert(OracleRouter.StalePrice.selector);
        router.getPrimaryPrice(XAU_USD);
    }

    // ============================================
    // ADMIN TESTS
    // ============================================

    function test_add_source() public {
        bytes32 newMarket = keccak256("NEW");
        MockOracleAdapter newOracle = new MockOracleAdapter();
        newOracle.addMarket(newMarket);

        router.addSource(newMarket, address(newOracle), WAD, true);

        OracleRouter.OracleSource[] memory sources = router.getSources(newMarket);
        assertEq(sources.length, 1, "Should have 1 source");
        assertEq(sources[0].source, address(newOracle), "Should be new oracle");
        assertTrue(sources[0].isPrimary, "Should be primary");
    }

    function test_remove_source() public {
        router.removeSource(XAU_USD, address(mockOracle3));

        OracleRouter.OracleSource[] memory sources = router.getSources(XAU_USD);
        assertEq(sources.length, 2, "Should have 2 sources after removal");
    }

    function test_update_source() public {
        uint256 newWeight = WAD / 2;
        router.updateSource(XAU_USD, address(mockOracle2), newWeight, true);

        OracleRouter.OracleSource[] memory sources = router.getSources(XAU_USD);

        bool found = false;
        for (uint i = 0; i < sources.length; i++) {
            if (sources[i].source == address(mockOracle2)) {
                assertEq(sources[i].weight, newWeight, "Weight should be updated");
                found = true;
            }
        }
        assertTrue(found, "Source should exist");
    }

    // ============================================
    // FUZZ TESTS
    // ============================================

    function testFuzz_aggregation_bounds(uint256 p1, uint256 p2, uint256 p3) public {
        // Bound prices to reasonable range
        p1 = bound(p1, 1e18, 1e24);
        p2 = bound(p2, 1e18, 1e24);
        p3 = bound(p3, 1e18, 1e24);

        mockOracle1.setPrice(XAU_USD, p1, WAD, WAD);
        mockOracle2.setPrice(XAU_USD, p2, WAD, WAD);
        mockOracle3.setPrice(XAU_USD, p3, WAD, WAD);

        AggregatedPrice memory agg = router.getAggregatedPrice(XAU_USD);

        // Aggregated price should be within bounds of inputs
        uint256 minPrice = p1 < p2 ? (p1 < p3 ? p1 : p3) : (p2 < p3 ? p2 : p3);
        uint256 maxPrice = p1 > p2 ? (p1 > p3 ? p1 : p3) : (p2 > p3 ? p2 : p3);

        assertGe(agg.price, minPrice / 2, "Price should not be below half of min");
        assertLe(agg.price, maxPrice * 2, "Price should not be above double of max");
    }

    function testFuzz_confidence_bounds(uint256 age) public {
        age = bound(age, 0, MAX_STALENESS - 1);

        mockOracle1.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - age);
        mockOracle2.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - age);
        mockOracle3.setPriceWithTimestamp(XAU_USD, 2000 * WAD, WAD, WAD, block.timestamp - age);

        AggregatedPrice memory agg = router.getAggregatedPrice(XAU_USD);

        // Confidence should always be in [0, 1]
        assertLe(agg.confidence, WAD, "Confidence should not exceed 1");
        assertGe(agg.confidence, 0, "Confidence should not be negative");
    }
}
