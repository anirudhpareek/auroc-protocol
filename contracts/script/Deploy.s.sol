// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import { OracleRouter } from "../src/oracle/OracleRouter.sol";
import { MockOracleAdapter } from "../src/oracle/MockOracleAdapter.sol";
import { IndexEngine } from "../src/engines/IndexEngine.sol";
import { RiskController } from "../src/engines/RiskController.sol";
import { FundingEngine } from "../src/engines/FundingEngine.sol";
import { LiquidationEngine } from "../src/engines/LiquidationEngine.sol";
import { Vault } from "../src/core/Vault.sol";
import { PerpEngine } from "../src/core/PerpEngine.sol";
import { InsuranceFund } from "../src/core/InsuranceFund.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { Regime } from "../src/types/DataTypes.sol";

/// @title Deploy
/// @notice Deployment script for RWA Perp DEX on Arbitrum Sepolia
contract Deploy is Script {
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

    // Vault params
    uint256 constant MAX_UTILIZATION = 8e17;
    uint256 constant MIN_LIQUIDITY = 1000e6;

    // Market IDs
    bytes32 constant XAU_USD = keccak256("XAU/USD");
    bytes32 constant SPX_USD = keccak256("SPX/USD");

    // ============================================
    // DEPLOYMENT
    // ============================================

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deploying from:", deployer);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mock USDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed:", address(usdc));

        // 2. Deploy Oracle Infrastructure
        OracleRouter oracleRouter = new OracleRouter(
            MAX_STALENESS,
            TAU_DECAY,
            TARGET_SOURCES,
            S0_DISPERSION
        );
        console.log("OracleRouter deployed:", address(oracleRouter));

        MockOracleAdapter mockOracle = new MockOracleAdapter();
        console.log("MockOracleAdapter deployed:", address(mockOracle));

        // 3. Deploy Index Engine
        IndexEngine indexEngine = new IndexEngine(
            address(oracleRouter),
            D0_CLAMP,
            D1_CLAMP,
            STRESS_THRESHOLD,
            TRANSITION_DURATION
        );
        console.log("IndexEngine deployed:", address(indexEngine));

        // 4. Deploy Risk Controller
        RiskController riskController = new RiskController(
            address(indexEngine),
            STRESS_THRESHOLD
        );
        console.log("RiskController deployed:", address(riskController));

        // 5. Deploy Vault
        Vault vault = new Vault(
            address(usdc),
            6, // USDC decimals
            MAX_UTILIZATION,
            MIN_LIQUIDITY
        );
        console.log("Vault deployed:", address(vault));

        // 6. Deploy Insurance Fund
        InsuranceFund insuranceFund = new InsuranceFund(address(usdc));
        console.log("InsuranceFund deployed:", address(insuranceFund));

        // 7. Deploy Perp Engine
        PerpEngine perpEngine = new PerpEngine(
            address(usdc),
            address(vault),
            address(indexEngine),
            address(riskController)
        );
        console.log("PerpEngine deployed:", address(perpEngine));

        // 8. Deploy Funding Engine
        FundingEngine fundingEngine = new FundingEngine(
            address(indexEngine),
            FUNDING_INTERVAL,
            OFF_HOURS_CLAMP
        );
        console.log("FundingEngine deployed:", address(fundingEngine));

        // 9. Deploy Liquidation Engine
        LiquidationEngine liquidationEngine = new LiquidationEngine(
            address(usdc),
            address(perpEngine),
            address(indexEngine),
            address(vault),
            address(insuranceFund)
        );
        console.log("LiquidationEngine deployed:", address(liquidationEngine));

        // ============================================
        // CONFIGURATION
        // ============================================

        // Configure oracle sources
        mockOracle.addMarkets(_marketIds());
        for (uint i = 0; i < _marketIds().length; i++) {
            oracleRouter.addSource(_marketIds()[i], address(mockOracle), WAD, true);
        }

        // Register markets with Index Engine
        indexEngine.registerMarket(XAU_USD, Regime.OFF_HOURS);
        indexEngine.registerMarket(SPX_USD, Regime.OFF_HOURS);

        // Configure risk parameters
        riskController.setBaseParams(
            XAU_USD,
            MAX_LEVERAGE,
            MAX_OI,
            SPREAD_BASE,
            SPREAD_CONF,
            SPREAD_VOL,
            SPREAD_UTIL
        );
        riskController.setImpactCoefficient(XAU_USD, IMPACT_COEFF);

        riskController.setBaseParams(
            SPX_USD,
            MAX_LEVERAGE,
            MAX_OI,
            SPREAD_BASE,
            SPREAD_CONF,
            SPREAD_VOL,
            SPREAD_UTIL
        );
        riskController.setImpactCoefficient(SPX_USD, IMPACT_COEFF);

        // Configure funding
        fundingEngine.setFundingParams(XAU_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);
        fundingEngine.setFundingParams(SPX_USD, MAX_FUNDING_RATE, IMBALANCE_WEIGHT);
        fundingEngine.setPerpEngine(address(perpEngine));

        // Register markets with Perp Engine
        perpEngine.registerMarket(XAU_USD, MAX_LEVERAGE, MAX_OI, 5e16, 1e15, 5e14);
        perpEngine.registerMarket(SPX_USD, MAX_LEVERAGE, MAX_OI, 5e16, 1e15, 5e14);
        perpEngine.setFundingEngine(address(fundingEngine));

        // Authorize engines
        vault.setAuthorizedEngine(address(perpEngine), true);
        vault.setAuthorizedEngine(address(liquidationEngine), true);
        insuranceFund.setAuthorized(address(liquidationEngine), true);
        perpEngine.setAuthorizedLiquidator(address(liquidationEngine), true);

        // Set initial prices (for testing)
        mockOracle.setPrice(XAU_USD, 2000e18, WAD, WAD); // $2000/oz
        mockOracle.setPrice(SPX_USD, 5000e18, WAD, WAD); // 5000 points

        vm.stopBroadcast();

        // Log deployment summary
        console.log("\n=== DEPLOYMENT SUMMARY ===");
        console.log("USDC:", address(usdc));
        console.log("OracleRouter:", address(oracleRouter));
        console.log("MockOracle:", address(mockOracle));
        console.log("IndexEngine:", address(indexEngine));
        console.log("RiskController:", address(riskController));
        console.log("Vault:", address(vault));
        console.log("InsuranceFund:", address(insuranceFund));
        console.log("PerpEngine:", address(perpEngine));
        console.log("FundingEngine:", address(fundingEngine));
        console.log("LiquidationEngine:", address(liquidationEngine));
        console.log("========================\n");
    }

    function _marketIds() internal pure returns (bytes32[] memory) {
        bytes32[] memory ids = new bytes32[](2);
        ids[0] = XAU_USD;
        ids[1] = SPX_USD;
        return ids;
    }
}
