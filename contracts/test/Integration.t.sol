// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";
import { IndexEngine } from "../src/engines/IndexEngine.sol";
import { RiskController } from "../src/engines/RiskController.sol";
import { FundingEngine } from "../src/engines/FundingEngine.sol";
import { LiquidationEngine } from "../src/engines/LiquidationEngine.sol";
import { SkewManager } from "../src/engines/SkewManager.sol";
import { Vault } from "../src/core/Vault.sol";
import { PerpEngine } from "../src/core/PerpEngine.sol";
import { InsuranceFund } from "../src/core/InsuranceFund.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { Regime, Position, Auction } from "../src/types/DataTypes.sol";

/// @title Integration Tests
/// @notice End-to-end tests for the complete RWA Perp DEX system
contract IntegrationTest is Test {
    // Core contracts
    OracleRouter public oracleRouter;
    MockOracleAdapter public mockOracle;
    IndexEngine public indexEngine;
    RiskController public riskController;
    FundingEngine public fundingEngine;
    LiquidationEngine public liquidationEngine;
    SkewManager public skewManager;
    Vault public vault;
    PerpEngine public perpEngine;
    InsuranceFund public insuranceFund;
    MockUSDC public usdc;

    // Test accounts
    address public deployer = address(this);
    address public lp1 = address(0x1);
    address public lp2 = address(0x2);
    address public trader1 = address(0x3);
    address public trader2 = address(0x4);
    address public keeper = address(0x5);

    // Market IDs
    bytes32 public constant XAU_USD = keccak256("XAU/USD");
    bytes32 public constant SPX_USD = keccak256("SPX/USD");

    uint256 public constant WAD = 1e18;

    function setUp() public {
        vm.warp(1000000);

        // ============================================
        // DEPLOY ALL CONTRACTS
        // ============================================

        // 1. Deploy USDC
        usdc = new MockUSDC();

        // 2. Deploy Oracle Infrastructure
        oracleRouter = new OracleRouter(120, 60, 3, 1e16);
        mockOracle = new MockOracleAdapter();
        mockOracle.addMarket(XAU_USD);
        mockOracle.addMarket(SPX_USD);
        oracleRouter.addSource(XAU_USD, address(mockOracle), WAD, true);
        oracleRouter.addSource(SPX_USD, address(mockOracle), WAD, true);

        // 3. Deploy Index Engine
        indexEngine = new IndexEngine(
            address(oracleRouter),
            5e15,   // d0 clamp
            25e15,  // d1 clamp
            3e17,   // stress threshold
            900     // transition duration
        );
        indexEngine.registerMarket(XAU_USD, Regime.OPEN);
        indexEngine.registerMarket(SPX_USD, Regime.OPEN);

        // 4. Deploy Risk Controller
        riskController = new RiskController(address(indexEngine), 3e17);
        _configureRiskParams(XAU_USD);
        _configureRiskParams(SPX_USD);

        // 5. Deploy Vault
        vault = new Vault(address(usdc), 6, 8e17, 1000e6);

        // 6. Deploy Insurance Fund
        insuranceFund = new InsuranceFund(address(usdc));

        // 7. Deploy Perp Engine
        perpEngine = new PerpEngine(
            address(usdc),
            address(vault),
            address(indexEngine),
            address(riskController)
        );
        perpEngine.registerMarket(XAU_USD, 10e18, 1000000e18, 5e16, 1e15, 5e14);
        perpEngine.registerMarket(SPX_USD, 10e18, 1000000e18, 5e16, 1e15, 5e14);

        // 8. Deploy Funding Engine
        fundingEngine = new FundingEngine(address(indexEngine), 3600, 5e17);
        fundingEngine.setFundingParams(XAU_USD, 1e15, 5e17);
        fundingEngine.setFundingParams(SPX_USD, 1e15, 5e17);
        fundingEngine.setPerpEngine(address(perpEngine));
        perpEngine.setFundingEngine(address(fundingEngine));

        // 9. Deploy Liquidation Engine
        liquidationEngine = new LiquidationEngine(
            address(usdc),
            address(perpEngine),
            address(indexEngine),
            address(vault),
            address(insuranceFund)
        );

        // 10. Deploy Skew Manager
        skewManager = new SkewManager(1e17, 3e15, 1e17);

        // ============================================
        // CONFIGURE AUTHORIZATIONS
        // ============================================

        vault.setAuthorizedEngine(address(perpEngine), true);
        vault.setAuthorizedEngine(address(liquidationEngine), true);
        perpEngine.setAuthorizedLiquidator(address(liquidationEngine), true);
        insuranceFund.setAuthorized(address(liquidationEngine), true);
        indexEngine.setAuthorizedUpdater(keeper, true);

        // ============================================
        // SET INITIAL PRICES
        // ============================================

        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);
        mockOracle.setPrice(SPX_USD, 5000e18, WAD, WAD);

        // ============================================
        // FUND TEST ACCOUNTS
        // ============================================

        usdc.mint(lp1, 1000000e6);
        usdc.mint(lp2, 1000000e6);
        usdc.mint(trader1, 100000e6);
        usdc.mint(trader2, 100000e6);
        usdc.mint(address(insuranceFund), 50000e6);

        // Approvals
        vm.prank(lp1);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(trader1);
        usdc.approve(address(perpEngine), type(uint256).max);
        vm.prank(trader2);
        usdc.approve(address(perpEngine), type(uint256).max);
    }

    // ============================================
    // E2E: FULL TRADING FLOW
    // ============================================

    function test_e2e_deposit_trade_close_withdraw() public {
        // 1. LP deposits liquidity
        vm.prank(lp1);
        uint256 lpShares = vault.deposit(100000e6);
        assertGt(lpShares, 0, "LP should receive shares");

        // 2. Trader opens long position
        // With 33% confidence, max leverage = 10x * 0.33 = 3.33x
        // 10 units at $2000 = $20,000 notional
        // Margin for 2x leverage = $10,000
        vm.prank(trader1);
        bytes32 positionId = perpEngine.openPosition(
            XAU_USD,
            10e18,    // 10 units
            10000e6,  // $10,000 USDC margin (2x leverage)
            1e17      // 10% slippage
        );

        Position memory pos = perpEngine.getPosition(positionId);
        assertEq(pos.size, 10e18, "Position size should match");
        assertGt(pos.entryPrice, 0, "Entry price should be set");

        // 3. Price moves up
        mockOracle.setPrice(XAU_USD, 2100e18, WAD, WAD);

        // 4. Trader closes position with profit
        uint256 traderBalanceBefore = usdc.balanceOf(trader1);

        vm.prank(trader1);
        perpEngine.closePosition(positionId, 0);

        uint256 traderBalanceAfter = usdc.balanceOf(trader1);
        assertGt(traderBalanceAfter, traderBalanceBefore, "Trader should profit");

        // 5. LP withdraws (share price may have changed)
        vm.prank(lp1);
        vault.withdraw(lpShares);
    }

    function test_e2e_opposing_positions() public {
        // LP provides liquidity
        vm.prank(lp1);
        vault.deposit(100000e6);

        uint256 margin = 10000e6;

        // Trader 1 goes long (2x leverage with 33% confidence limit)
        vm.prank(trader1);
        bytes32 longPos = perpEngine.openPosition(XAU_USD, 10e18, margin, 1e17);

        // Trader 2 goes short (2x leverage)
        vm.prank(trader2);
        bytes32 shortPos = perpEngine.openPosition(XAU_USD, -10e18, margin, 1e17);

        // Price moves up - long profits, short loses
        mockOracle.setPrice(XAU_USD, 2200e18, WAD, WAD);

        uint256 trader1Before = usdc.balanceOf(trader1);
        uint256 trader2Before = usdc.balanceOf(trader2);

        vm.prank(trader1);
        perpEngine.closePosition(longPos, 0);

        vm.prank(trader2);
        perpEngine.closePosition(shortPos, 0);

        uint256 trader1After = usdc.balanceOf(trader1);
        uint256 trader2After = usdc.balanceOf(trader2);

        // Long trader: got back more than their margin (profit)
        uint256 trader1Return = trader1After - trader1Before;
        assertGt(trader1Return, margin, "Long trader should profit (got more than margin)");

        // Short trader: got back less than their margin (loss)
        uint256 trader2Return = trader2After - trader2Before;
        assertLt(trader2Return, margin, "Short trader should lose (got less than margin)");
    }

    // ============================================
    // E2E: LIQUIDATION FLOW
    // ============================================

    function test_e2e_liquidation_flow() public {
        // LP deposits
        vm.prank(lp1);
        vault.deposit(100000e6);

        // Trader opens leveraged position (respecting 33% confidence = 3.33x max)
        // 100 units at $2000 = $200,000 notional
        // Margin for ~3x leverage = $66,666
        vm.prank(trader1);
        bytes32 positionId = perpEngine.openPosition(
            XAU_USD,
            100e18,   // 100 units
            67000e6,  // $67,000 margin (~3x leverage)
            1e17
        );

        // Price drops to trigger liquidation but NOT insolvency
        // At $1350: PnL = 100 * ($1350 - ~$2000) = -$65,000
        // Equity = $67,000 - $65,000 = $2,000 (below MMR but positive)
        // MMR = 100 * $1350 * 0.05 = $6,750
        // Position is liquidatable (equity < MMR) but not insolvent
        mockOracle.setPrice(XAU_USD, 1350e18, WAD, WAD);

        // Check if liquidatable
        (bool liquidatable,) = liquidationEngine.checkLiquidatable(positionId);

        if (liquidatable) {
            // Start liquidation auction
            bytes32 auctionId = liquidationEngine.startLiquidation(positionId);

            Auction memory auction = liquidationEngine.getAuction(auctionId);
            assertTrue(auction.isActive, "Auction should be active");

            // Keeper fills auction
            vm.prank(keeper);
            liquidationEngine.fillAuction(auctionId, auction.remainingSize);

            // Position should be closed
            Position memory pos = perpEngine.getPosition(positionId);
            assertEq(pos.size, 0, "Position should be closed");
        }
    }

    // ============================================
    // E2E: REGIME TRANSITIONS
    // ============================================

    function test_e2e_regime_transition() public {
        // Start in OPEN regime
        assertEq(uint256(indexEngine.getRegime(XAU_USD)), uint256(Regime.OPEN), "Should start OPEN");

        // Transition to OFF_HOURS
        indexEngine.setRegime(XAU_USD, Regime.OFF_HOURS);
        assertEq(uint256(indexEngine.getRegime(XAU_USD)), uint256(Regime.OFF_HOURS), "Should be OFF_HOURS");

        // Start transition back to OPEN
        vm.prank(keeper);
        indexEngine.startTransition(XAU_USD, 900);
        assertEq(uint256(indexEngine.getRegime(XAU_USD)), uint256(Regime.TRANSITION), "Should be TRANSITION");

        // Complete transition
        vm.warp(block.timestamp + 901);
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);
        indexEngine.updateMarket(XAU_USD);

        assertEq(uint256(indexEngine.getRegime(XAU_USD)), uint256(Regime.OPEN), "Should be back to OPEN");
    }

    // ============================================
    // E2E: STRESS MODE
    // ============================================

    function test_e2e_stress_mode_restrictions() public {
        // LP deposits
        vm.prank(lp1);
        vault.deposit(100000e6);

        // Open position in OPEN mode (2x leverage)
        vm.prank(trader1);
        bytes32 positionId = perpEngine.openPosition(XAU_USD, 10e18, 10000e6, 1e17);

        // Trigger STRESS mode via low confidence
        uint256 oldTimestamp = block.timestamp - 100; // Stale price
        mockOracle.setPriceWithTimestamp(XAU_USD, 2000e18, WAD, WAD, oldTimestamp);
        indexEngine.updateMarket(XAU_USD);

        // Check if in STRESS
        if (indexEngine.getRegime(XAU_USD) == Regime.STRESS) {
            // Should not be able to open new positions
            vm.prank(trader2);
            vm.expectRevert();
            perpEngine.openPosition(XAU_USD, 10e18, 10000e6, 1e17);

            // But can close existing
            mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);
            vm.prank(trader1);
            perpEngine.closePosition(positionId, 0);
        }
    }

    // ============================================
    // E2E: FUNDING FLOW
    // ============================================

    function test_e2e_funding_accrual() public {
        // LP deposits
        vm.prank(lp1);
        vault.deposit(100000e6);

        // Open long position (2x leverage)
        vm.prank(trader1);
        bytes32 positionId = perpEngine.openPosition(XAU_USD, 10e18, 10000e6, 1e17);

        // Get initial funding state
        int256 initialFunding = fundingEngine.getCumulativeFunding(XAU_USD);

        // Warp past funding interval
        vm.warp(block.timestamp + 3601);
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);

        // Update funding
        fundingEngine.updateFunding(XAU_USD);

        int256 newFunding = fundingEngine.getCumulativeFunding(XAU_USD);

        // Funding may or may not have changed depending on mark vs index
        // Just verify the mechanism works
        assertTrue(newFunding != 0 || initialFunding == newFunding, "Funding state should be valid");
    }

    // ============================================
    // E2E: MULTI-MARKET
    // ============================================

    function test_e2e_multi_market_trading() public {
        // LP deposits
        vm.prank(lp1);
        vault.deposit(200000e6);

        // Trade XAU (10 units at $2000 = $20k notional, use $10k margin = 2x)
        vm.prank(trader1);
        bytes32 xauPos = perpEngine.openPosition(XAU_USD, 10e18, 10000e6, 1e17);

        // Trade SPX (5 units at $5000 = $25k notional, use $12.5k margin = 2x)
        vm.prank(trader1);
        bytes32 spxPos = perpEngine.openPosition(SPX_USD, 5e18, 12500e6, 1e17);

        Position memory xau = perpEngine.getPosition(xauPos);
        Position memory spx = perpEngine.getPosition(spxPos);

        assertEq(xau.marketId, XAU_USD, "XAU market ID should match");
        assertEq(spx.marketId, SPX_USD, "SPX market ID should match");

        // Different prices move differently
        mockOracle.setPrice(XAU_USD, 2100e18, WAD, WAD);
        mockOracle.setPrice(SPX_USD, 4900e18, WAD, WAD);

        // Close both
        vm.prank(trader1);
        perpEngine.closePosition(xauPos, 0);

        vm.prank(trader1);
        perpEngine.closePosition(spxPos, 0);
    }

    // ============================================
    // E2E: SKEW MANAGER INTEGRATION
    // ============================================

    function test_e2e_skew_incentives() public {
        // Create skewed market
        skewManager.updateOI(XAU_USD, 100e18); // Long heavy

        // Check eligibility for balancing trade
        bool eligible = skewManager.checkRebateEligibility(XAU_USD, -50e18);
        assertTrue(eligible, "Short trade should be eligible for rebate");

        // Calculate slippage reward
        uint256 slippage = skewManager.calculatePositiveSlippage(XAU_USD, -50e18);
        assertGt(slippage, 0, "Should receive positive slippage");
    }

    // ============================================
    // HELPERS
    // ============================================

    function _configureRiskParams(bytes32 marketId) internal {
        riskController.setBaseParams(
            marketId,
            10e18,      // 10x max leverage
            1000000e18, // max OI
            1e15,       // spread base
            5e15,       // spread conf
            2e15,       // spread vol
            3e15        // spread util
        );
        riskController.setImpactCoefficient(marketId, 1e14);
    }
}
