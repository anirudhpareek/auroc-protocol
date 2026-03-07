// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Regime } from "./DataTypes.sol";

// ============================================
// ENUMS
// ============================================

/// @notice Call or Put
enum OptionType { CALL, PUT }

/// @notice Long = buyer, Short = writer/seller
enum OptionSide { LONG, SHORT }

// ============================================
// STRUCTS
// ============================================

/// @notice Single option leg
struct OptionLeg {
    bytes32  marketId;    // Auroc market (XAU_USD / SPX_USD)
    uint256  strike;      // Strike price in WAD (1e18)
    OptionType optionType;
    OptionSide side;
    uint256  notional;    // Option notional in USD WAD
}

/// @notice Live multi-leg option position (1–4 legs)
struct OptionPosition {
    bytes32    positionId;
    address    owner;
    uint256    legCount;
    OptionLeg[4] legs;           // Fixed-size array for gas efficiency
    uint256    collateralLocked; // Total USDC locked (6 decimals)
    uint256    premiumPaid;      // Total premium paid by net buyer (6 decimals)
    uint256    openedAt;
    Regime     regimeAtOpen;
}

/// @notice Option Greeks — all in WAD
struct Greeks {
    int256  delta;    // dV/dS
    int256  gamma;    // d²V/dS²
    int256  theta;    // dV/dt per day (negative for long options)
    int256  vega;     // dV/dσ
    uint256 iv;       // Implied vol, WAD annualized (e.g. 0.2e18 = 20%)
    uint256 premium;  // Current option value in WAD (as % of notional)
}

/// @notice Collateral breakdown for a set of legs
struct CollateralRequirement {
    uint256 buyerPremium;      // Total premium buyers must pay (USDC 6 dec)
    uint256 sellerCollateral;  // Total collateral sellers must post (USDC 6 dec)
    uint256 total;             // = buyerPremium + sellerCollateral
}
