// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { LiquidationEngine } from "../src/engines/LiquidationEngine.sol";
import { ILiquidationEngine } from "../src/interfaces/ILiquidationEngine.sol";
import { PerpEngine } from "../src/core/PerpEngine.sol";
import { IndexEngine } from "../src/engines/IndexEngine.sol";
import { RiskController } from "../src/engines/RiskController.sol";
import { Vault } from "../src/core/Vault.sol";
import { InsuranceFund } from "../src/core/InsuranceFund.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { Regime, Auction, Position, PositionEquity } from "../src/types/DataTypes.sol";

contract LiquidationEngineTest is Test {
    LiquidationEngine public liquidationEngine;
    PerpEngine public perpEngine;
    IndexEngine public indexEngine;
    RiskController public riskController;
    Vault public vault;
    InsuranceFund public insuranceFund;
    OracleRouter public oracleRouter;
    MockOracleAdapter public mockOracle;
    MockUSDC public usdc;

    address public trader = address(0x1);
    address public keeper = address(0x2);
    address public lp = address(0x3);

    bytes32 public constant XAU_USD = keccak256("XAU/USD");

    uint256 public constant WAD = 1e18;

    function setUp() public {
        vm.warp(1000000);

        // Deploy USDC
        usdc = new MockUSDC();

        // Deploy oracle infrastructure
        oracleRouter = new OracleRouter(120, 60, 3, 1e16);
        mockOracle = new MockOracleAdapter();
        mockOracle.addMarket(XAU_USD);
        oracleRouter.addSource(XAU_USD, address(mockOracle), WAD, true);

        // Deploy index engine
        indexEngine = new IndexEngine(
            address(oracleRouter),
            5e15,
            25e15,
            3e17,
            900
        );
        indexEngine.registerMarket(XAU_USD, Regime.OPEN);

        // Deploy risk controller
        riskController = new RiskController(address(indexEngine), 3e17);
        riskController.setBaseParams(
            XAU_USD,
            10e18,      // 10x leverage
            1000000e18, // max OI
            1e15,       // spread base
            5e15,       // spread conf
            2e15,       // spread vol
            3e15        // spread util
        );
        riskController.setImpactCoefficient(XAU_USD, 1e14);

        // Deploy vault
        vault = new Vault(address(usdc), 6, 8e17, 1000e6);

        // Deploy insurance fund
        insuranceFund = new InsuranceFund(address(usdc));

        // Deploy perp engine
        perpEngine = new PerpEngine(
            address(usdc),
            address(vault),
            address(indexEngine),
            address(riskController)
        );
        perpEngine.registerMarket(XAU_USD, 10e18, 1000000e18, 5e16, 1e15, 5e14);

        // Deploy liquidation engine
        liquidationEngine = new LiquidationEngine(
            address(usdc),
            address(perpEngine),
            address(indexEngine),
            address(vault),
            address(insuranceFund)
        );

        // Configure authorizations
        vault.setAuthorizedEngine(address(perpEngine), true);
        vault.setAuthorizedEngine(address(liquidationEngine), true);
        perpEngine.setAuthorizedLiquidator(address(liquidationEngine), true);
        insuranceFund.setAuthorized(address(liquidationEngine), true);

        // Set initial price
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);

        // Fund LP
        usdc.mint(lp, 1000000e6);
        vm.prank(lp);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(lp);
        vault.deposit(100000e6);

        // Fund trader
        usdc.mint(trader, 100000e6);
        vm.prank(trader);
        usdc.approve(address(perpEngine), type(uint256).max);
    }

    // ============================================
    // AUCTION PRICE TESTS
    // ============================================

    function test_auction_price_linear_decay() public {
        // Setup: Create a position and liquidate it
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        // At start
        uint256 priceAtStart = liquidationEngine.getCurrentAuctionPrice(auctionId);
        assertEq(priceAtStart, auction.startPrice, "Price should be start price at t=0");

        // At midpoint
        vm.warp(block.timestamp + auction.duration / 2);
        uint256 priceAtMid = liquidationEngine.getCurrentAuctionPrice(auctionId);

        uint256 expectedMid = (auction.startPrice + auction.endPrice) / 2;
        assertApproxEqRel(priceAtMid, expectedMid, 1e16, "Price should be at midpoint");

        // At end
        vm.warp(block.timestamp + auction.duration / 2);
        uint256 priceAtEnd = liquidationEngine.getCurrentAuctionPrice(auctionId);
        assertEq(priceAtEnd, auction.endPrice, "Price should be end price at t=duration");
    }

    function test_auction_progress() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        // At start
        (uint256 elapsed, uint256 remaining, uint256 percentComplete) =
            liquidationEngine.getAuctionProgress(auctionId);

        assertEq(elapsed, 0, "Elapsed should be 0");
        assertEq(remaining, auction.duration, "Remaining should be full duration");
        assertEq(percentComplete, 0, "Percent should be 0");

        // At 50%
        vm.warp(block.timestamp + auction.duration / 2);
        (elapsed, remaining, percentComplete) = liquidationEngine.getAuctionProgress(auctionId);

        assertEq(elapsed, auction.duration / 2, "Elapsed should be half");
        assertEq(remaining, auction.duration / 2, "Remaining should be half");
        assertEq(percentComplete, WAD / 2, "Percent should be 50%");
    }

    // ============================================
    // START LIQUIDATION TESTS
    // ============================================

    function test_start_liquidation() public {
        bytes32 positionId = _createLiquidatablePosition();

        // Check position is liquidatable
        (bool liquidatable, PositionEquity memory equity) =
            liquidationEngine.checkLiquidatable(positionId);
        assertTrue(liquidatable, "Position should be liquidatable");

        // Start liquidation
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);
        assertTrue(auction.isActive, "Auction should be active");
        assertEq(auction.positionId, positionId, "Position ID should match");
    }

    function test_start_liquidation_reverts_not_liquidatable() public {
        // Create healthy position
        bytes32 positionId = _createHealthyPosition();

        vm.expectRevert(ILiquidationEngine.PositionNotLiquidatable.selector);
        liquidationEngine.startLiquidation(positionId);
    }

    function test_has_active_auction() public {
        bytes32 positionId = _createLiquidatablePosition();

        assertFalse(liquidationEngine.hasActiveAuction(positionId), "Should not have auction initially");

        liquidationEngine.startLiquidation(positionId);

        assertTrue(liquidationEngine.hasActiveAuction(positionId), "Should have active auction");
    }

    // ============================================
    // FILL AUCTION TESTS
    // ============================================

    function test_fill_auction_partial() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auctionBefore = liquidationEngine.getAuction(auctionId);
        int256 fillSize = auctionBefore.remainingSize / 2;

        vm.prank(keeper);
        liquidationEngine.fillAuction(auctionId, fillSize);

        Auction memory auctionAfter = liquidationEngine.getAuction(auctionId);
        assertEq(
            auctionAfter.remainingSize,
            auctionBefore.remainingSize - fillSize,
            "Remaining size should decrease"
        );
        assertTrue(auctionAfter.isActive, "Auction should still be active");
    }

    function test_fill_auction_complete() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        vm.prank(keeper);
        liquidationEngine.fillAuction(auctionId, auction.remainingSize);

        Auction memory auctionAfter = liquidationEngine.getAuction(auctionId);
        assertFalse(auctionAfter.isActive, "Auction should be inactive after full fill");
    }

    function test_fill_auction_reverts_expired() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        // Warp past expiry
        vm.warp(block.timestamp + auction.duration + 1);

        vm.prank(keeper);
        vm.expectRevert(ILiquidationEngine.AuctionExpired.selector);
        liquidationEngine.fillAuction(auctionId, auction.remainingSize);
    }

    function test_fill_auction_reverts_inactive() public {
        bytes32 fakeAuctionId = keccak256("fake");

        vm.prank(keeper);
        vm.expectRevert(ILiquidationEngine.AuctionNotActive.selector);
        liquidationEngine.fillAuction(fakeAuctionId, 100e18);
    }

    // ============================================
    // KEEPER PROFIT TESTS
    // ============================================

    function test_calculate_keeper_profit() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        (uint256 profit, uint256 fillPrice) =
            liquidationEngine.calculateKeeperProfit(auctionId, auction.remainingSize);

        assertGt(fillPrice, 0, "Fill price should be positive");
        // Profit depends on mark vs auction price relationship
    }

    // ============================================
    // CANCEL AUCTION TESTS
    // ============================================

    function test_cancel_auction_expired() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        Auction memory auction = liquidationEngine.getAuction(auctionId);

        // Warp past expiry
        vm.warp(block.timestamp + auction.duration + 1);
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);

        // Cancel should work (triggers backstop)
        liquidationEngine.cancelAuction(auctionId);

        Auction memory auctionAfter = liquidationEngine.getAuction(auctionId);
        assertFalse(auctionAfter.isActive, "Auction should be cancelled");
    }

    function test_cancel_auction_reverts_not_expired() public {
        bytes32 positionId = _createLiquidatablePosition();
        bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

        vm.expectRevert(ILiquidationEngine.AuctionNotFound.selector);
        liquidationEngine.cancelAuction(auctionId);
    }

    // ============================================
    // BACKSTOP TESTS
    // ============================================

    function test_backstop_liquidation_insolvent() public {
        bytes32 positionId = _createInsolventPosition();

        // Fund insurance
        usdc.mint(address(insuranceFund), 10000e6);

        // Backstop should work for insolvent positions
        liquidationEngine.backstopLiquidation(positionId);
    }

    // ============================================
    // CONFIG TESTS
    // ============================================

    function test_set_auction_params() public {
        liquidationEngine.setAuctionParams(1200, 3e16, 15e16);

        assertEq(liquidationEngine.auctionDuration(), 1200, "Duration should be updated");
        assertEq(liquidationEngine.startPenalty(), 3e16, "Start penalty should be updated");
        assertEq(liquidationEngine.endPenalty(), 15e16, "End penalty should be updated");
    }

    function test_set_mmr_params() public {
        liquidationEngine.setMMRParams(6e16, 3e18);

        assertEq(liquidationEngine.mmrBase(), 6e16, "MMR base should be updated");
        assertEq(liquidationEngine.mmrMultiplierMax(), 3e18, "MMR multiplier should be updated");
    }

    function test_set_insolvency_buffer() public {
        liquidationEngine.setInsolvencyBuffer(2e16);

        assertEq(liquidationEngine.insolvencyBuffer(), 2e16, "Buffer should be updated");
    }

    function test_set_chunk_size() public {
        liquidationEngine.setChunkSize(20e16);

        assertEq(liquidationEngine.chunkSize(), 20e16, "Chunk size should be updated");
    }

    // ============================================
    // VIEW TESTS
    // ============================================

    function test_get_active_auctions() public {
        bytes32 positionId = _createLiquidatablePosition();
        liquidationEngine.startLiquidation(positionId);

        bytes32[] memory activeAuctions = liquidationEngine.getActiveAuctions(XAU_USD);
        assertEq(activeAuctions.length, 1, "Should have one active auction");

        bytes32[] memory allActive = liquidationEngine.getAllActiveAuctions();
        assertEq(allActive.length, 1, "Should have one in all auctions");
    }

    // ============================================
    // ACCESS CONTROL TESTS
    // ============================================

    function test_only_owner_can_set_params() public {
        vm.prank(address(0xdead));
        vm.expectRevert();
        liquidationEngine.setAuctionParams(1200, 3e16, 15e16);
    }

    // ============================================
    // HELPERS
    // ============================================

    function _createHealthyPosition() internal returns (bytes32) {
        // With 33% confidence, max leverage = 10x * 0.33 = 3.33x
        // 10 units at $2000 = $20,000 notional
        // Margin needed for ~2x leverage = $10,000
        vm.prank(trader);
        return perpEngine.openPosition(
            XAU_USD,
            10e18,    // 10 units long
            10000e6,  // $10,000 USDC margin (2x leverage - safe for 3.33x limit)
            1e17      // 10% slippage tolerance
        );
    }

    function _createLiquidatablePosition() internal returns (bytes32) {
        // With 33% confidence, max leverage = 3.33x
        // 100 units at $2000 = $200,000 notional
        // Margin for ~3x leverage = $66,666
        vm.prank(trader);
        bytes32 positionId = perpEngine.openPosition(
            XAU_USD,
            100e18,   // 100 units long
            67000e6,  // $67,000 margin (~3x leverage, within 3.33x limit)
            1e17
        );

        // Drop price to make position liquidatable but NOT insolvent
        // At $1350: PnL = 100 * ($1350 - ~$2000) = -$65,000
        // Equity = $67,000 - $65,000 = $2,000 (below MMR but not insolvent)
        // MMR = 100 * $1350 * 0.05 = $6,750
        // Insolvency threshold = -$1,350 (100 * $1350 / 100)
        // Equity ($2,000) < MMR ($6,750) = LIQUIDATABLE
        // Equity ($2,000) > Insolvency threshold (-$1,350) = NOT INSOLVENT
        mockOracle.setPrice(XAU_USD, 1350e18, WAD, WAD); // -32.5%

        return positionId;
    }

    function _createInsolventPosition() internal returns (bytes32) {
        vm.prank(trader);
        bytes32 positionId = perpEngine.openPosition(
            XAU_USD,
            100e18,   // 100 units
            67000e6,  // $67,000 margin (~3x leverage)
            1e17
        );

        // Massive price drop to create insolvent position
        // At $1000: PnL = 100 * ($1000 - ~$2000) = -$100,000
        // Equity = $67,000 - $100,000 = -$33,000 (deeply negative)
        mockOracle.setPrice(XAU_USD, 1000e18, WAD, WAD); // -50%

        return positionId;
    }
}
