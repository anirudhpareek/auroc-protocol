// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

// Oracle
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";

// Engines
import { IndexEngine } from "../src/engines/IndexEngine.sol";
import { RiskController } from "../src/engines/RiskController.sol";
import { FundingEngine } from "../src/engines/FundingEngine.sol";
import { LiquidationEngine } from "../src/engines/LiquidationEngine.sol";
import { SkewManager } from "../src/engines/SkewManager.sol";
import { PremiaCalculator } from "../src/engines/PremiaCalculator.sol";

// Core
import { Vault } from "../src/core/Vault.sol";
import { LiquidityBuffer } from "../src/core/LiquidityBuffer.sol";
import { PerpEngineV2 } from "../src/core/PerpEngineV2.sol";
import { InsuranceFund } from "../src/core/InsuranceFund.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";

import { Regime } from "../src/types/DataTypes.sol";

/// @title DeployV2
/// @notice Deployment script for Auroc Protocol V2 with enhanced features:
///         - Two-tier liquidity (Ostium-style)
///         - OI skew incentives (Avantis-style)
///         - Risk-based premia (Vest-style)
contract DeployV2 is Script {
    // ============================================
    // CONSTANTS
    // ============================================

    uint256 constant WAD = 1e18;

    // Oracle params
    uint256 constant MAX_STALENESS = 120;
    uint256 constant TAU_DECAY = 60;
    uint256 constant TARGET_SOURCES = 3;
    uint256 constant S0_DISPERSION = 1e16;

    // Index engine params
    uint256 constant D0_CLAMP = 5e15;
    uint256 constant D1_CLAMP = 25e15;
    uint256 constant STRESS_THRESHOLD = 3e17;
    uint256 constant TRANSITION_DURATION = 900;

    // Risk params
    uint256 constant MAX_LEVERAGE = 10e18;
    uint256 constant MAX_OI = 1_000_000e18;
    uint256 constant SPREAD_BASE = 1e15;
    uint256 constant SPREAD_CONF = 5e15;
    uint256 constant SPREAD_VOL = 2e15;
    uint256 constant SPREAD_UTIL = 3e15;
    uint256 constant IMPACT_COEFF = 1e14;

    // Funding params
    uint256 constant FUNDING_INTERVAL = 3600;
    uint256 constant OFF_HOURS_CLAMP = 5e17;
    uint256 constant MAX_FUNDING_RATE = 1e15;
    uint256 constant IMBALANCE_WEIGHT = 5e17;

    // Vault/Buffer params
    uint256 constant MAX_UTILIZATION = 8e17;
    uint256 constant MIN_LIQUIDITY = 1000e6;
    uint256 constant TARGET_BUFFER_SIZE = 100_000e6; // $100k buffer target

    // Skew Manager params (Avantis-style)
    uint256 constant LOSS_REBATE_RATE = 2e17;       // 20% rebate on losses
    uint256 constant POSITIVE_SLIPPAGE_RATE = 3e15; // 0.3% positive slippage
    uint256 constant MIN_SKEW_FOR_INCENTIVE = 1e17; // 10% skew threshold

    // Premia Calculator params (Vest-style)
    uint256 constant BASE_PREMIA_RATE = 5e15;        // 0.5% base
    uint256 constant CONCENTRATION_MULTIPLIER = 2e18;
    uint256 constant VOLATILITY_MULTIPLIER = 15e17;
    uint256 constant CONFIDENCE_MULTIPLIER = 2e18;

    // Market IDs
    bytes32 constant XAU_USD = keccak256("XAU/USD");
    bytes32 constant SPX_USD = keccak256("SPX/USD");

    // ============================================
    // DEPLOYMENT
    // ============================================

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("=== AUROC PROTOCOL V2 DEPLOYMENT ===");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", block.chainid);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // ============================================
        // 1. DEPLOY BASE INFRASTRUCTURE
        // ============================================

        console.log("1. Deploying base infrastructure...");

        // Mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("   MockUSDC:", address(usdc));

        // Oracle Router
        OracleRouter oracleRouter = new OracleRouter(
            MAX_STALENESS, TAU_DECAY, TARGET_SOURCES, S0_DISPERSION
        );
        console.log("   OracleRouter:", address(oracleRouter));

        // Mock Oracle
        MockOracleAdapter mockOracle = new MockOracleAdapter();
        console.log("   MockOracleAdapter:", address(mockOracle));

        // ============================================
        // 2. DEPLOY INDEX ENGINE
        // ============================================

        console.log("2. Deploying IndexEngine...");

        IndexEngine indexEngine = new IndexEngine(
            address(oracleRouter), D0_CLAMP, D1_CLAMP, STRESS_THRESHOLD, TRANSITION_DURATION
        );
        console.log("   IndexEngine:", address(indexEngine));

        // ============================================
        // 3. DEPLOY RISK CONTROLLER
        // ============================================

        console.log("3. Deploying RiskController...");

        RiskController riskController = new RiskController(
            address(indexEngine), STRESS_THRESHOLD
        );
        console.log("   RiskController:", address(riskController));

        // ============================================
        // 4. DEPLOY TWO-TIER LIQUIDITY (Ostium-style)
        // ============================================

        console.log("4. Deploying Two-Tier Liquidity...");

        // Liquidity Buffer (first-loss layer)
        LiquidityBuffer liquidityBuffer = new LiquidityBuffer(
            address(usdc), TARGET_BUFFER_SIZE, 6 // USDC has 6 decimals
        );
        console.log("   LiquidityBuffer:", address(liquidityBuffer));

        // LP Vault (second layer)
        Vault vault = new Vault(address(usdc), 6, MAX_UTILIZATION, MIN_LIQUIDITY);
        console.log("   Vault:", address(vault));

        // Insurance Fund
        InsuranceFund insuranceFund = new InsuranceFund(address(usdc));
        console.log("   InsuranceFund:", address(insuranceFund));

        // ============================================
        // 5. DEPLOY SKEW MANAGER (Avantis-style)
        // ============================================

        console.log("5. Deploying SkewManager (Avantis-style)...");

        SkewManager skewManager = new SkewManager(
            LOSS_REBATE_RATE, POSITIVE_SLIPPAGE_RATE, MIN_SKEW_FOR_INCENTIVE
        );
        console.log("   SkewManager:", address(skewManager));

        // ============================================
        // 6. DEPLOY PREMIA CALCULATOR (Vest-style)
        // ============================================

        console.log("6. Deploying PremiaCalculator (Vest-style)...");

        PremiaCalculator premiaCalculator = new PremiaCalculator(
            address(indexEngine),
            BASE_PREMIA_RATE,
            CONCENTRATION_MULTIPLIER,
            VOLATILITY_MULTIPLIER,
            CONFIDENCE_MULTIPLIER
        );
        console.log("   PremiaCalculator:", address(premiaCalculator));

        // ============================================
        // 7. DEPLOY PERP ENGINE V2
        // ============================================

        console.log("7. Deploying PerpEngineV2...");

        PerpEngineV2 perpEngine = new PerpEngineV2(
            address(usdc),
            address(liquidityBuffer),
            address(indexEngine),
            address(riskController),
            address(skewManager),
            address(premiaCalculator)
        );
        console.log("   PerpEngineV2:", address(perpEngine));

        // ============================================
        // 8. DEPLOY FUNDING ENGINE
        // ============================================

        console.log("8. Deploying FundingEngine...");

        FundingEngine fundingEngine = new FundingEngine(
            address(indexEngine), FUNDING_INTERVAL, OFF_HOURS_CLAMP
        );
        console.log("   FundingEngine:", address(fundingEngine));

        // ============================================
        // 9. DEPLOY LIQUIDATION ENGINE
        // ============================================

        console.log("9. Deploying LiquidationEngine...");

        LiquidationEngine liquidationEngine = new LiquidationEngine(
            address(usdc),
            address(perpEngine),
            address(indexEngine),
            address(vault),
            address(insuranceFund)
        );
        console.log("   LiquidationEngine:", address(liquidationEngine));

        // ============================================
        // 10. WIRE EVERYTHING TOGETHER
        // ============================================

        console.log("10. Wiring components...");

        // Oracle setup
        mockOracle.addMarket(XAU_USD);
        mockOracle.addMarket(SPX_USD);
        oracleRouter.addSource(XAU_USD, address(mockOracle), WAD, true);
        oracleRouter.addSource(SPX_USD, address(mockOracle), WAD, true);

        // Register markets
        indexEngine.registerMarket(XAU_USD, Regime.OFF_HOURS);
        indexEngine.registerMarket(SPX_USD, Regime.OFF_HOURS);

        // Risk params per market
        riskController.setBaseParams(XAU_USD, MAX_LEVERAGE, MAX_OI, SPREAD_BASE, SPREAD_CONF, SPREAD_VOL, SPREAD_UTIL);
        riskController.setImpactCoefficient(XAU_USD, IMPACT_COEFF);
        riskController.setBaseParams(SPX_USD, MAX_LEVERAGE, MAX_OI, SPREAD_BASE, SPREAD_CONF, SPREAD_VOL, SPREAD_UTIL);
        riskController.setImpactCoefficient(SPX_USD, IMPACT_COEFF);

        // Premia calculator market config
        premiaCalculator.setMarketRiskParams(XAU_USD, MAX_OI, 2e16); // 2% base vol
        premiaCalculator.setMarketRiskParams(SPX_USD, MAX_OI, 15e15); // 1.5% base vol

        // Funding params
        fundingEngine.setFundingParams(XAU_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);
        fundingEngine.setFundingParams(SPX_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);
        fundingEngine.setPerpEngine(address(perpEngine));

        // Perp engine market registration
        perpEngine.registerMarket(XAU_USD, MAX_LEVERAGE, MAX_OI, 5e16, 1e15, 5e14);
        perpEngine.registerMarket(SPX_USD, MAX_LEVERAGE, MAX_OI, 5e16, 1e15, 5e14);
        perpEngine.setFundingEngine(address(fundingEngine));

        // Authorization
        liquidityBuffer.setVault(address(vault));
        liquidityBuffer.setAuthorizedEngine(address(perpEngine), true);
        vault.setAuthorizedEngine(address(perpEngine), true);
        vault.setAuthorizedEngine(address(liquidationEngine), true);
        insuranceFund.setAuthorized(address(liquidationEngine), true);
        perpEngine.setAuthorizedLiquidator(address(liquidationEngine), true);

        // Set initial prices
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD);
        mockOracle.setPrice(SPX_USD, 5000e18, WAD, WAD);

        vm.stopBroadcast();

        // ============================================
        // DEPLOYMENT SUMMARY
        // ============================================

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("");
        console.log("Core:");
        console.log("  USDC:", address(usdc));
        console.log("  PerpEngineV2:", address(perpEngine));
        console.log("");
        console.log("Two-Tier Liquidity (Ostium-style):");
        console.log("  LiquidityBuffer:", address(liquidityBuffer));
        console.log("  Vault:", address(vault));
        console.log("  InsuranceFund:", address(insuranceFund));
        console.log("");
        console.log("Enhanced Pricing:");
        console.log("  SkewManager (Avantis):", address(skewManager));
        console.log("  PremiaCalculator (Vest):", address(premiaCalculator));
        console.log("");
        console.log("Engines:");
        console.log("  IndexEngine:", address(indexEngine));
        console.log("  RiskController:", address(riskController));
        console.log("  FundingEngine:", address(fundingEngine));
        console.log("  LiquidationEngine:", address(liquidationEngine));
        console.log("");
        console.log("Oracle:");
        console.log("  OracleRouter:", address(oracleRouter));
        console.log("  MockOracle:", address(mockOracle));
        console.log("");
        console.log("Features enabled:");
        console.log("  - Two-tier liquidity (buffer + vault)");
        console.log("  - Loss rebates: 20% for balancing trades");
        console.log("  - Positive slippage: 0.3% for reducing skew");
        console.log("  - Risk-based premia: 0.5% base rate");
        console.log("==============================");
    }
}
