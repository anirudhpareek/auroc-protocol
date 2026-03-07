// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { RealizedVolOracle } from "./RealizedVolOracle.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title VolSurface
/// @notice Implied volatility surface for Auroc options.
/// @dev IV = realized_vol * skewFactor(moneyness) * regimeFactor
///
///      Skew model (volatility smile):
///        skew = 1 + skewSlope * |ln(K/S)|
///      Where K = strike, S = spot.
///
///      For calls: slight upside skew (calls vol > ATM vol when K > S)
///      For puts:  steeper downside skew (puts vol > ATM vol when K < S)
///
///      Regime amplifier: during TRANSITION, vol is boosted by 10%.
contract VolSurface is Ownable2Step {
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD         = 1e18;
    uint256 public constant MIN_IV      = 5e15;   //  0.5% minimum IV floor
    uint256 public constant MAX_IV      = 3e18;   // 300% maximum IV cap

    // ============================================
    // STATE
    // ============================================

    RealizedVolOracle public volOracle;
    IIndexEngine      public indexEngine;

    /// @notice Per-market skew parameters
    struct SkewParams {
        uint256 callSkewSlope; // Additional skew for OTM calls (WAD)
        uint256 putSkewSlope;  // Additional skew for OTM puts (WAD)
        uint256 regimeBump;    // Vol boost during TRANSITION regime (WAD)
        bool    configured;
    }

    mapping(bytes32 => SkewParams) public skewParams;

    // ============================================
    // EVENTS
    // ============================================

    event SkewParamsSet(bytes32 indexed marketId, uint256 callSlope, uint256 putSlope);

    // ============================================
    // ERRORS
    // ============================================

    error MarketNotConfigured();
    error StrikeZero();
    error SpotZero();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _volOracle, address _indexEngine) Ownable(msg.sender) {
        volOracle    = RealizedVolOracle(_volOracle);
        indexEngine  = IIndexEngine(_indexEngine);
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get implied vol for a given market, strike, and option type
    /// @param marketId  Auroc market ID
    /// @param strike    Strike price in WAD
    /// @param isCall    True for call, false for put
    /// @return iv       Implied volatility in WAD (e.g. 0.20e18 = 20%)
    function getIV(
        bytes32 marketId,
        uint256 strike,
        bool    isCall
    ) external view returns (uint256 iv) {
        if (strike == 0) revert StrikeZero();

        SkewParams storage params = skewParams[marketId];
        if (!params.configured) revert MarketNotConfigured();

        // Base realized vol
        uint256 baseVol = volOracle.getVol(marketId);
        if (baseVol == 0) baseVol = 2e17; // Fallback: 20% if oracle cold-starting

        // Spot price from index engine
        uint256 spot = indexEngine.getIndexPrice(marketId);
        if (spot == 0) revert SpotZero();

        // Moneyness: |ln(strike / spot)| in WAD
        uint256 moneyness;
        if (strike >= spot) {
            moneyness = uint256(MathLib.ln((strike * WAD) / spot));
        } else {
            moneyness = uint256(-MathLib.ln((spot   * WAD) / strike));
            // Absolute value
            if (int256(moneyness) < 0) moneyness = uint256(-int256(moneyness));
        }

        // Skew multiplier
        uint256 skewSlope = isCall ? params.callSkewSlope : params.putSkewSlope;
        uint256 skewAdd   = moneyness.mulWad(skewSlope); // WAD * WAD / WAD = WAD
        uint256 skewFactor = WAD + skewAdd;              // > 1 for OTM options

        iv = baseVol.mulWad(skewFactor);

        // Regime bump
        if (params.regimeBump > 0) {
            // Import Regime inline to avoid circular import issues
            uint8 regime = uint8(indexEngine.getRegime(marketId));
            if (regime == 2 /* TRANSITION */) {
                iv = iv.mulWad(WAD + params.regimeBump);
            }
        }

        // Clamp
        if (iv < MIN_IV) iv = MIN_IV;
        if (iv > MAX_IV) iv = MAX_IV;
    }

    /// @notice ATM IV shortcut (strike = current spot)
    function getATMIV(bytes32 marketId) external view returns (uint256) {
        uint256 spot = indexEngine.getIndexPrice(marketId);
        return this.getIV(marketId, spot, true); // Call ATM = Put ATM
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Configure skew parameters for a market
    /// @param callSkewSlope  Extra vol per unit of ln(K/S) for calls (WAD)
    ///                       e.g. 0.5e18 = 50%/unit of log-moneyness
    /// @param putSkewSlope   Extra vol per unit of ln(S/K) for puts (WAD)
    /// @param regimeBump     Vol boost during TRANSITION (WAD, e.g. 0.1e18 = +10%)
    function setSkewParams(
        bytes32 marketId,
        uint256 callSkewSlope,
        uint256 putSkewSlope,
        uint256 regimeBump
    ) external onlyOwner {
        skewParams[marketId] = SkewParams({
            callSkewSlope: callSkewSlope,
            putSkewSlope:  putSkewSlope,
            regimeBump:    regimeBump,
            configured:    true
        });
        emit SkewParamsSet(marketId, callSkewSlope, putSkewSlope);
    }

    function setVolOracle(address _volOracle) external onlyOwner {
        volOracle = RealizedVolOracle(_volOracle);
    }

    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }
}
