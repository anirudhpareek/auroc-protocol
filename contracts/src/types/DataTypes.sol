// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DataTypes
/// @notice Core data structures for the RWA Perp DEX

// ============================================
// ENUMS
// ============================================

/// @notice Market regime states
enum Regime {
    OPEN,       // Normal trading - primary oracle feed
    OFF_HOURS,  // Market closed - synthetic pricing
    TRANSITION, // Reopen convergence period
    STRESS      // Emergency - close only, no new positions
}

/// @notice Position direction
enum Side {
    LONG,
    SHORT
}

// ============================================
// ORACLE TYPES
// ============================================

/// @notice Single oracle source price data
struct OraclePrice {
    uint256 price;      // Price in WAD (1e18)
    uint256 timestamp;  // Unix timestamp
    uint256 confidence; // Source confidence [0, 1e18]
    uint256 liquidity;  // Relative liquidity score [0, 1e18]
}

/// @notice Aggregated price with confidence metrics
struct AggregatedPrice {
    uint256 price;       // P_syn - synthetic price in WAD
    uint256 confidence;  // C - overall confidence [0, 1e18]
    uint256 dispersion;  // sigma - price dispersion
    uint256 sourceCount; // Number of valid sources used
    uint256 timestamp;   // Aggregation timestamp
}

/// @notice Oracle source configuration
struct OracleSource {
    address source;     // Oracle adapter address
    uint256 weight;     // Relative weight [0, 1e18]
    bool isPrimary;     // True if primary (market hours) source
    bool isActive;      // Can be disabled
}

// ============================================
// MARKET TYPES
// ============================================

/// @notice Market configuration
struct Market {
    bytes32 marketId;           // Unique market identifier
    string symbol;              // e.g., "XAU/USD", "SPX/USD"
    uint256 maxLeverage;        // Base max leverage in WAD (e.g., 10e18 = 10x)
    uint256 maxOI;              // Max open interest in USD (WAD)
    uint256 maintenanceMargin;  // MMR base rate in WAD (e.g., 0.05e18 = 5%)
    uint256 takerFee;           // Taker fee in WAD
    uint256 makerFee;           // Maker fee in WAD
    bool isActive;              // Trading enabled
}

/// @notice Market state (mutable)
struct MarketState {
    Regime regime;              // Current regime
    uint256 regimeChangedAt;    // Timestamp of last regime change
    int256 openInterest;        // Net OI (long - short), can be negative
    uint256 longOI;             // Total long OI in USD
    uint256 shortOI;            // Total short OI in USD
    int256 cumulativeFunding;   // Cumulative funding per unit size (WAD)
    uint256 lastFundingUpdate;  // Last funding timestamp
    uint256 lastIndexPrice;     // Cached index price
    uint256 lastMarkPrice;      // Cached mark price
    uint256 lastConfidence;     // Cached confidence
}

/// @notice Regime transition state
struct TransitionState {
    uint256 startTime;      // Transition start timestamp
    uint256 duration;       // Total transition duration
    uint256 preSynPrice;    // P_syn at transition start
    uint256 maxGapPercent;  // Detected gap size in WAD
    bool isActive;          // Transition in progress
}

// ============================================
// POSITION TYPES
// ============================================

/// @notice Trader position
struct Position {
    bytes32 positionId;     // Unique position ID
    address trader;         // Position owner
    bytes32 marketId;       // Market identifier
    int256 size;            // Position size (positive = long, negative = short)
    uint256 entryPrice;     // Average entry price (WAD)
    uint256 margin;         // Collateral deposited (in collateral decimals)
    int256 fundingAccum;    // Cumulative funding at entry
    uint256 openedAt;       // Position open timestamp
    uint256 lastUpdated;    // Last modification timestamp
}

/// @notice Position equity breakdown
struct PositionEquity {
    int256 unrealizedPnL;   // Price PnL
    int256 fundingPnL;      // Funding PnL
    int256 totalEquity;     // margin + unrealizedPnL + fundingPnL
    uint256 maintenanceReq; // Required maintenance margin
    bool isLiquidatable;    // E < MMR
    bool isInsolvent;       // E < -buffer
}

// ============================================
// LIQUIDATION TYPES
// ============================================

/// @notice Dutch auction for liquidation
struct Auction {
    bytes32 auctionId;      // Unique auction ID
    bytes32 positionId;     // Position being liquidated
    address trader;         // Original position owner
    bytes32 marketId;       // Market identifier
    int256 originalSize;    // Original position size
    int256 remainingSize;   // Size left to liquidate
    uint256 startPrice;     // Auction start price (with penalty)
    uint256 endPrice;       // Auction end price (max penalty)
    uint256 startTime;      // Auction start timestamp
    uint256 duration;       // Auction duration
    bool isActive;          // Auction in progress
}

// ============================================
// VAULT TYPES
// ============================================

/// @notice Vault state
struct VaultState {
    uint256 totalAssets;        // Total USDC in vault
    uint256 totalShares;        // Total LP shares
    uint256 totalDebt;          // Unrealized PnL owed to traders
    uint256 utilizationRate;    // Current utilization (WAD)
    uint256 lastUpdateTime;     // Last state update
}

// ============================================
// RISK TYPES
// ============================================

/// @notice Dynamic risk parameters per market
struct RiskParams {
    uint256 effectiveLeverage;  // Max leverage adjusted by C
    uint256 effectiveSpread;    // Spread adjusted by C, vol, util
    uint256 effectiveOICap;     // OI cap adjusted by C
    bool closeOnly;             // Only closes allowed
    bool increaseOnly;          // Only increases allowed (rare)
}
