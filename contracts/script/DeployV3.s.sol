// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Script, console } from "forge-std/Script.sol";
import { RealizedVolOracle }       from "../src/options/RealizedVolOracle.sol";
import { VolSurface }              from "../src/options/VolSurface.sol";
import { AurocCollateralTracker }  from "../src/options/AurocCollateralTracker.sol";
import { AurocOptionsPool }        from "../src/options/AurocOptionsPool.sol";
import { PremiaCalculator }        from "../src/engines/PremiaCalculator.sol";

/// @title DeployV3
/// @notice Deploys the Panoptic-inspired options layer on top of existing Auroc V2 contracts.
///         Run with:
///           forge script script/DeployV3.s.sol --rpc-url arbitrum_sepolia --broadcast -vvvv
///
///         Reads existing contract addresses from environment:
///           ORACLE_ROUTER_ADDRESS
///           INDEX_ENGINE_ADDRESS
///           PERP_ENGINE_V2_ADDRESS
///           PREMIA_CALCULATOR_ADDRESS
///           USDC_ADDRESS
///           KEEPER_ADDRESS   (optional: sets as keeper on vol oracle)
contract DeployV3 is Script {

    // ============================================
    // SEED VOL PARAMS (Arbitrum Sepolia testnet)
    // ============================================

    uint256 constant SEED_VOL_XAU  = 15e16;  // 15% annualized vol for gold
    uint256 constant SEED_VOL_SPX  = 18e16;  // 18% annualized vol for SPX

    // Skew params: 50% extra vol per unit of log-moneyness for OTM, 10% regime bump
    uint256 constant CALL_SKEW     = 5e17;
    uint256 constant PUT_SKEW      = 7e17;
    uint256 constant REGIME_BUMP   = 1e17;

    // ============================================
    // DEPLOY
    // ============================================

    function run() external {
        uint256 deployerPk = vm.envUint("PRIVATE_KEY");
        address deployer   = vm.addr(deployerPk);

        address oracleRouter      = vm.envAddress("ORACLE_ROUTER_ADDRESS");
        address indexEngine       = vm.envAddress("INDEX_ENGINE_ADDRESS");
        address perpEngineV2      = vm.envAddress("PERP_ENGINE_V2_ADDRESS");
        address premiaCalculator  = vm.envAddress("PREMIA_CALCULATOR_ADDRESS");
        address usdc              = vm.envAddress("USDC_ADDRESS");
        address keeper            = vm.envOr("KEEPER_ADDRESS", deployer);

        bytes32 marketXau = keccak256("XAU/USD");
        bytes32 marketSpx = keccak256("SPX/USD");

        console.log("=== Auroc V3 Options Layer Deploy ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPk);

        // ─── 1. RealizedVolOracle ─────────────────────────────────────────
        RealizedVolOracle volOracle = new RealizedVolOracle(oracleRouter, indexEngine);
        volOracle.registerMarket(marketXau, SEED_VOL_XAU);
        volOracle.registerMarket(marketSpx, SEED_VOL_SPX);
        volOracle.setKeeper(keeper, true);
        console.log("RealizedVolOracle:", address(volOracle));

        // ─── 2. VolSurface ────────────────────────────────────────────────
        VolSurface volSurface = new VolSurface(address(volOracle), indexEngine);
        volSurface.setSkewParams(marketXau, CALL_SKEW, PUT_SKEW, REGIME_BUMP);
        volSurface.setSkewParams(marketSpx, CALL_SKEW, PUT_SKEW, REGIME_BUMP);
        console.log("VolSurface:", address(volSurface));

        // ─── 3. AurocCollateralTracker (ERC4626) ─────────────────────────
        AurocCollateralTracker tracker = new AurocCollateralTracker(
            usdc,
            "Auroc Unified LP",
            "aUSD"
        );
        // Authorize existing perp engine as engine
        tracker.setAuthorizedEngine(perpEngineV2, true);
        console.log("AurocCollateralTracker:", address(tracker));

        // ─── 4. AurocOptionsPool ──────────────────────────────────────────
        AurocOptionsPool optionsPool = new AurocOptionsPool(
            usdc,
            indexEngine,
            address(volSurface),
            address(tracker)
        );
        optionsPool.registerMarket(marketXau);
        optionsPool.registerMarket(marketSpx);
        // Authorize options pool to lock/release collateral in tracker
        tracker.setAuthorizedEngine(address(optionsPool), true);
        console.log("AurocOptionsPool:", address(optionsPool));

        // ─── 5. Wire VolSurface into PremiaCalculator ─────────────────────
        PremiaCalculator(premiaCalculator).setIVSurface(address(volSurface));
        console.log("PremiaCalculator wired to VolSurface");

        vm.stopBroadcast();

        // ─── Summary ─────────────────────────────────────────────────────
        console.log("\n=== Deployment Summary ===");
        console.log("RealizedVolOracle:        ", address(volOracle));
        console.log("VolSurface:               ", address(volSurface));
        console.log("AurocCollateralTracker:   ", address(tracker));
        console.log("AurocOptionsPool:         ", address(optionsPool));
        console.log("\nNext steps:");
        console.log("  1. Update .env.local with contract addresses above");
        console.log("  2. Fund tracker with initial USDC for LP backing");
        console.log("  3. Start keeper bot: npm run keeper -- --vol-oracle", address(volOracle));
    }
}

/// @dev Helper lib for market IDs (kept in same file for script simplicity)
library MARKETS {
    function xauUsd() internal pure returns (bytes32) {
        return keccak256("XAU/USD");
    }
    function spxUsd() internal pure returns (bytes32) {
        return keccak256("SPX/USD");
    }
}
