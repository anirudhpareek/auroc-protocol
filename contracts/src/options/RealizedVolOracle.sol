// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IOracleRouter } from "../interfaces/IOracleRouter.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { AggregatedPrice, Regime } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title RealizedVolOracle
/// @notice Tracks realized volatility from OracleRouter price history.
/// @dev Uses a circular buffer of BUFFER_SIZE price snapshots.
///      σ = sqrt(Σ ln(P_t/P_{t-1})² / (N-1)) * sqrt(ANNUALIZATION)
///      Vol is frozen during OFF_HOURS / STRESS — returns last OPEN value.
///      Keeper-triggered via update(). Min 10-minute interval between updates.
contract RealizedVolOracle is Ownable2Step {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD              = 1e18;
    uint256 public constant BUFFER_SIZE      = 96;     // ~24 h at 15-min snapshots
    uint256 public constant ANNUALIZATION    = 35040;  // 96 * 365
    uint256 public constant MIN_SAMPLES      = 10;
    uint256 public constant MIN_INTERVAL     = 600;    // 10 min between updates

    // ============================================
    // STATE
    // ============================================

    IOracleRouter public oracleRouter;
    IIndexEngine  public indexEngine;

    struct VolState {
        uint256[96] prices;      // Circular buffer of raw prices (WAD)
        uint256     head;        // Next write index
        uint256     sampleCount; // Total samples, capped at BUFFER_SIZE
        uint256     lastUpdate;  // Unix timestamp of last update
        uint256     currentVol;  // Current annualized vol (WAD)
        uint256     lastOpenVol; // Last vol recorded during OPEN regime (WAD)
    }

    mapping(bytes32 => VolState) private _states;
    mapping(bytes32 => bool)     public  registeredMarkets;
    mapping(address => bool)     public  keepers;

    // ============================================
    // EVENTS
    // ============================================

    event VolUpdated(bytes32 indexed marketId, uint256 vol, uint256 sampleCount);
    event MarketRegistered(bytes32 indexed marketId, uint256 seedVol);

    // ============================================
    // ERRORS
    // ============================================

    error MarketNotRegistered();
    error NotAuthorized();
    error TooSoon();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _oracleRouter, address _indexEngine) Ownable(msg.sender) {
        oracleRouter = IOracleRouter(_oracleRouter);
        indexEngine  = IIndexEngine(_indexEngine);
    }

    // ============================================
    // KEEPER — called by off-chain bot
    // ============================================

    /// @notice Record a new price snapshot and recompute vol
    function update(bytes32 marketId) external {
        if (!keepers[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        if (!registeredMarkets[marketId]) revert MarketNotRegistered();

        VolState storage s = _states[marketId];
        if (block.timestamp < s.lastUpdate + MIN_INTERVAL) revert TooSoon();

        AggregatedPrice memory agg = oracleRouter.getAggregatedPrice(marketId);
        if (agg.price == 0) return;

        // Write into circular buffer
        s.prices[s.head] = agg.price;
        s.head            = (s.head + 1) % BUFFER_SIZE;
        if (s.sampleCount < BUFFER_SIZE) s.sampleCount++;
        s.lastUpdate = block.timestamp;

        if (s.sampleCount >= MIN_SAMPLES) {
            uint256 vol  = _computeVol(s);
            s.currentVol = vol;

            Regime regime = indexEngine.getRegime(marketId);
            if (regime == Regime.OPEN) {
                s.lastOpenVol = vol;
            }
            emit VolUpdated(marketId, vol, s.sampleCount);
        }
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get current annualized vol (WAD). Returns frozen value off-hours.
    function getVol(bytes32 marketId) external view returns (uint256) {
        if (!registeredMarkets[marketId]) revert MarketNotRegistered();
        VolState storage s = _states[marketId];

        Regime regime = indexEngine.getRegime(marketId);
        if (regime != Regime.OPEN && regime != Regime.TRANSITION) {
            // Freeze vol during off-hours/stress — use last OPEN value
            return s.lastOpenVol > 0 ? s.lastOpenVol : s.currentVol;
        }
        return s.currentVol;
    }

    function getVolState(bytes32 marketId) external view returns (
        uint256 currentVol,
        uint256 lastOpenVol,
        uint256 sampleCount,
        uint256 lastUpdate
    ) {
        VolState storage s = _states[marketId];
        return (s.currentVol, s.lastOpenVol, s.sampleCount, s.lastUpdate);
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Realized vol = sqrt(Σ lr² / (N-1)) * sqrt(ANNUALIZATION)
    ///      where lr = ln(P_t / P_{t-1}) for each consecutive pair in the buffer
    function _computeVol(VolState storage s) internal view returns (uint256) {
        uint256 n = s.sampleCount < BUFFER_SIZE ? s.sampleCount : BUFFER_SIZE;
        if (n < 2) return s.currentVol; // Not enough data, keep old value

        uint256 sumSq      = 0;
        uint256 validPairs = 0;

        for (uint256 i = 1; i < n; i++) {
            // Walk backward through the circular buffer
            uint256 curr = s.prices[(s.head + BUFFER_SIZE - i)       % BUFFER_SIZE];
            uint256 prev = s.prices[(s.head + BUFFER_SIZE - (i + 1)) % BUFFER_SIZE];
            if (prev == 0 || curr == 0) continue;

            // Log return in WAD
            int256 lr;
            if (curr >= prev) {
                lr =  MathLib.ln((curr * WAD) / prev);
            } else {
                lr = -MathLib.ln((prev * WAD) / curr);
            }

            // lr² in WAD
            int256 sq = MathLib.mulWadInt(lr, lr);
            if (sq > 0) {
                sumSq += uint256(sq);
                validPairs++;
            }
        }

        if (validPairs < 2) return s.currentVol;

        // Variance per sample (WAD)
        uint256 variance = sumSq / validPairs;

        // Annualize: σ² * ANNUALIZATION (still WAD)
        uint256 annualVar = variance * ANNUALIZATION;

        // σ_annual = sqrt(annualVar) in WAD
        return _sqrtWad(annualVar);
    }

    /// @dev Integer sqrt returning WAD-scaled result
    ///      sqrtWad(x) = sqrt(x_real) in WAD, where x is WAD-scaled
    ///      = isqrt(x * WAD)
    function _sqrtWad(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = x * WAD; // Avoids overflow for x <= type(uint128).max
        uint256 y = z;
        uint256 q = (z + 1) / 2;
        while (q < y) {
            y = q;
            q = (z / q + q) / 2;
        }
        return y;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Register a market with a seed vol
    /// @param seedVol Initial annualized vol in WAD (e.g. 0.15e18 = 15%)
    function registerMarket(bytes32 marketId, uint256 seedVol) external onlyOwner {
        registeredMarkets[marketId] = true;
        _states[marketId].currentVol  = seedVol;
        _states[marketId].lastOpenVol = seedVol;
        emit MarketRegistered(marketId, seedVol);
    }

    function setKeeper(address keeper, bool authorized) external onlyOwner {
        keepers[keeper] = authorized;
    }

    function setOracleRouter(address _oracleRouter) external onlyOwner {
        oracleRouter = IOracleRouter(_oracleRouter);
    }

    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }
}
