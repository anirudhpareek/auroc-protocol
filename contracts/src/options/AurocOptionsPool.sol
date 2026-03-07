// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

import { IOptionsPool } from "../interfaces/IOptionsPool.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { OptionLeg, OptionPosition, Greeks, CollateralRequirement, OptionType, OptionSide } from "../types/OptionsTypes.sol";
import { Regime } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { VolSurface } from "./VolSurface.sol";
import { AurocCollateralTracker } from "./AurocCollateralTracker.sol";

/// @title AurocOptionsPool
/// @notice Perpetual options on Auroc RWA markets — fully collateralized, no counterparty risk.
/// @dev    Pricing: simplified Black-Scholes ATM approximation with VolSurface skew.
///
///         Premium model (as % of notional, WAD):
///           ATM: C_pct = IV * sqrt(T) * INV_SQRT_2PI
///           OTM/ITM: adjusted by moneyness discount/premium
///
///         Collateral model:
///           LONG  leg: deposit premium_usdc only
///           SHORT leg: deposit notional_usdc * (1 + SELLER_BUFFER + premium_pct)
///
///         Regime gate: only OPEN and TRANSITION allow new mints.
///         STRESS and OFF_HOURS → close-only (burns allowed).
///
///         Panoptic V2 tokenId encoding: option positions are identified by a
///         packed uint256 encoding up to 4 legs. Each leg occupies 64 bits:
///           [0..31]  strike (scaled to 32-bit precision)
///           [32]     isCall
///           [33]     isShort
///           [34..63] notional (scaled)
contract AurocOptionsPool is IOptionsPool, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD            = 1e18;
    uint256 public constant SQRT_T         = 286478897565412e3; // sqrt(30/365) in WAD ≈ 0.2865
    uint256 public constant INV_SQRT_2PI   = 398942280401433e3; // 1/sqrt(2π) in WAD ≈ 0.3989
    uint256 public constant SELLER_BUFFER  = 1e17;              // 10% extra seller collateral
    uint256 public constant MIN_NOTIONAL   = 1e4;               // $0.0001 in WAD minimum
    uint256 public constant MAX_LEGS       = 4;
    uint256 public constant USDC_SCALE     = 1e12;              // WAD → USDC (18 → 6 dec)

    // ============================================
    // STATE
    // ============================================

    IERC20                 public immutable collateral; // USDC
    IIndexEngine           public indexEngine;
    VolSurface             public volSurface;
    AurocCollateralTracker public collateralTracker;

    /// @notice Registered markets
    mapping(bytes32 => bool) public registeredMarkets;

    /// @notice Option positions
    mapping(bytes32 => OptionPosition) public optionPositions;

    /// @notice Per-trader position list
    mapping(address => bytes32[]) public traderOptions;
    mapping(bytes32 => uint256)   private _positionIndex;

    uint256 public positionNonce;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _collateral,
        address _indexEngine,
        address _volSurface,
        address _collateralTracker
    ) Ownable(msg.sender) {
        collateral         = IERC20(_collateral);
        indexEngine        = IIndexEngine(_indexEngine);
        volSurface         = VolSurface(_volSurface);
        collateralTracker  = AurocCollateralTracker(_collateralTracker);
    }

    // ============================================
    // MODIFIERS
    // ============================================

    /// @dev Revert if market is in STRESS or OFF_HOURS regime
    modifier whenOptionsActive(bytes32 marketId) {
        Regime r = indexEngine.getRegime(marketId);
        if (r == Regime.STRESS || r == Regime.OFF_HOURS) {
            revert OptionsSuspended(marketId);
        }
        _;
    }

    // ============================================
    // TRADING
    // ============================================

    /// @inheritdoc IOptionsPool
    function mintOption(
        OptionLeg[] calldata legs,
        uint256 maxCost
    ) external override nonReentrant whenNotPaused returns (bytes32 positionId) {
        if (legs.length == 0 || legs.length > MAX_LEGS) revert InvalidLegCount();

        // Validate all legs in same (registered) market and regime-gated
        bytes32 primaryMarket = legs[0].marketId;
        for (uint256 i = 0; i < legs.length; i++) {
            if (!registeredMarkets[legs[i].marketId]) revert MarketNotRegistered();
            if (legs[i].strike == 0) revert StrikeMustBePositive();
            if (legs[i].notional < MIN_NOTIONAL) revert NotionalTooSmall();
            // Regime check per market (allows multi-market legs if both open)
            Regime r = indexEngine.getRegime(legs[i].marketId);
            if (r == Regime.STRESS || r == Regime.OFF_HOURS) revert OptionsSuspended(legs[i].marketId);
        }

        // Compute collateral requirements
        CollateralRequirement memory req = _computeCollateral(legs);
        uint256 totalCost = req.total;
        if (totalCost > maxCost) revert CostExceedsMax();

        // Transfer collateral from caller
        if (totalCost > 0) {
            collateral.safeTransferFrom(msg.sender, address(this), totalCost);
        }

        // Lock seller collateral in tracker
        positionNonce++;
        positionId = keccak256(abi.encodePacked(msg.sender, primaryMarket, positionNonce));

        // Notify tracker of locked seller collateral for LP accounting
        if (req.sellerCollateral > 0) {
            collateralTracker.notifyLock(positionId, req.sellerCollateral);
        }

        // Store position
        OptionPosition storage pos = optionPositions[positionId];
        pos.positionId       = positionId;
        pos.owner            = msg.sender;
        pos.legCount         = legs.length;
        pos.collateralLocked = totalCost;
        pos.premiumPaid      = req.buyerPremium;
        pos.openedAt         = block.timestamp;
        pos.regimeAtOpen     = indexEngine.getRegime(primaryMarket);

        for (uint256 i = 0; i < legs.length; i++) {
            pos.legs[i] = legs[i];
        }

        // Track position
        traderOptions[msg.sender].push(positionId);
        _positionIndex[positionId] = traderOptions[msg.sender].length - 1;

        emit OptionMinted(positionId, msg.sender, primaryMarket, legs.length, totalCost, req.buyerPremium);
    }

    /// @inheritdoc IOptionsPool
    function burnOption(
        bytes32 positionId,
        uint256 minPayout
    ) external override nonReentrant returns (uint256 payout) {
        OptionPosition storage pos = optionPositions[positionId];
        if (pos.positionId == bytes32(0)) revert PositionNotFound();
        if (pos.owner != msg.sender)      revert NotPositionOwner();

        // Current value of the position
        uint256 currentValue = _computeCurrentValue(pos);

        // Payout: buyers get current value; sellers get collateral minus current liability
        payout = _computePayout(pos, currentValue);
        if (payout < minPayout) revert PayoutBelowMin();

        // Release LP accounting entry in tracker (no token transfer — pool holds tokens)
        uint256 sellerLocked = _getSellerLocked(pos);
        if (sellerLocked > 0) {
            collateralTracker.notifyRelease(positionId, sellerLocked);
        }

        // Transfer payout to owner from pool's own USDC balance
        uint256 actualPayout = payout > pos.collateralLocked ? pos.collateralLocked : payout;
        if (actualPayout > 0) {
            collateral.safeTransfer(msg.sender, actualPayout);
        }

        int256 pnl = int256(actualPayout) - int256(pos.collateralLocked);
        emit OptionBurned(positionId, msg.sender, pnl);

        // Clean up
        _removePosition(positionId, msg.sender);
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @inheritdoc IOptionsPool
    function getOptionPosition(bytes32 positionId) external view override returns (OptionPosition memory) {
        return optionPositions[positionId];
    }

    /// @inheritdoc IOptionsPool
    function getTraderOptions(address trader) external view override returns (bytes32[] memory) {
        return traderOptions[trader];
    }

    /// @inheritdoc IOptionsPool
    function getGreeks(
        bytes32 marketId,
        uint256 strike,
        bool    isCall
    ) external view override returns (Greeks memory greeks) {
        uint256 spot = indexEngine.getIndexPrice(marketId);
        uint256 iv   = volSurface.getIV(marketId, strike, isCall);

        greeks.iv      = iv;
        greeks.premium = _atmPremiumPct(iv);

        // Delta: approximate via N(d1)
        // d1 = ln(S/K)/(σ√T) + 0.5σ√T
        // For ATM: d1 ≈ 0.5*σ*√T, N(d1) ≈ 0.5 + 0.3989*d1 (linear approx near 0)
        if (spot > 0 && strike > 0) {
            int256 logSK;  // ln(S/K) in WAD
            if (spot >= strike) {
                logSK =  MathLib.ln((spot   * WAD) / strike);
            } else {
                logSK = -MathLib.ln((strike * WAD) / spot);
            }

            // σ√T in WAD
            uint256 sigSqrtT = iv.mulWad(SQRT_T);

            // d1 ≈ logSK / sigSqrtT + 0.5 * sigSqrtT
            int256 d1;
            if (sigSqrtT > 0) {
                d1 = int256(MathLib.divWad(uint256(logSK < 0 ? uint256(-logSK) : uint256(logSK)), sigSqrtT));
                if (logSK < 0) d1 = -d1;
                d1 += int256(sigSqrtT / 2);
            }

            // N(d1) ≈ 0.5 + 0.3989 * d1 (accurate for |d1| < 1, clamp for far OTM)
            int256 nd1;
            int256 d1_clamped = MathLib.clampInt(d1, -3e18, 3e18);
            nd1 = int256(5e17) + MathLib.mulWadInt(int256(3989e14), d1_clamped);
            nd1 = MathLib.clampInt(nd1, 5e15, 995e15); // clamp to (0.005, 0.995)

            greeks.delta = isCall ? nd1 : nd1 - int256(WAD);

            // Gamma = φ(d1) / (S * σ√T)  ≈ 0.3989 * exp(-d1²/2) / (S * σ√T)
            // Simplified: Gamma ≈ 0.3989 / (S * σ√T) for ATM
            if (spot > 0 && sigSqrtT > 0) {
                uint256 denom  = spot.mulWad(sigSqrtT);
                greeks.gamma   = int256(uint256(3989e14 * WAD) / denom);
            }

            // Theta ≈ -S * σ * φ(0) / (2√T) / 365  (per day, WAD)
            // φ(0) = 0.3989
            if (SQRT_T > 0) {
                uint256 thetaNum = spot.mulWad(iv).mulWad(3989e14);
                greeks.theta     = -int256(thetaNum / (2 * 365 * SQRT_T / WAD + 1));
            }

            // Vega = S * √T * φ(d1) ≈ S * √T * 0.3989 (ATM)
            greeks.vega = int256(spot.mulWad(SQRT_T).mulWad(3989e14));
        }
    }

    /// @inheritdoc IOptionsPool
    function getRequiredCollateral(
        OptionLeg[] calldata legs
    ) external view override returns (CollateralRequirement memory) {
        return _computeCollateral(legs);
    }

    /// @inheritdoc IOptionsPool
    function getCurrentValue(bytes32 positionId) external view override returns (uint256) {
        OptionPosition storage pos = optionPositions[positionId];
        if (pos.positionId == bytes32(0)) revert PositionNotFound();
        return _computeCurrentValue(pos);
    }

    // ============================================
    // INTERNAL — COLLATERAL
    // ============================================

    function _computeCollateral(
        OptionLeg[] calldata legs
    ) internal view returns (CollateralRequirement memory req) {
        for (uint256 i = 0; i < legs.length; i++) {
            OptionLeg calldata leg = legs[i];
            uint256 spot  = indexEngine.getIndexPrice(leg.marketId);
            uint256 iv    = volSurface.getIV(leg.marketId, leg.strike, leg.optionType == OptionType.CALL);
            uint256 premPct = _atmPremiumPct(iv);

            // Notional in USDC (6 decimals): leg.notional is in WAD, spot is in WAD
            // usdc_notional = leg.notional (WAD) * spot (WAD) / WAD / USDC_SCALE
            uint256 notionalUsdc = leg.notional.mulWad(spot) / USDC_SCALE;

            // Premium in USDC
            uint256 premiumUsdc = notionalUsdc.mulWad(premPct);

            if (leg.side == OptionSide.LONG) {
                // Buyer pays premium
                req.buyerPremium += premiumUsdc;
            } else {
                // Seller posts: notional + 10% buffer + premium (to pay out to buyer)
                uint256 sellerUsdc = notionalUsdc.mulWad(WAD + SELLER_BUFFER) + premiumUsdc;
                req.sellerCollateral += sellerUsdc;
            }
        }
        req.total = req.buyerPremium + req.sellerCollateral;
    }

    // ============================================
    // INTERNAL — PRICING
    // ============================================

    /// @dev ATM premium as % of notional (WAD): C_pct = IV * sqrt(T) * (1/sqrt(2π))
    function _atmPremiumPct(uint256 iv) internal pure returns (uint256) {
        // C_pct = iv * SQRT_T * INV_SQRT_2PI
        return iv.mulWad(SQRT_T).mulWad(INV_SQRT_2PI);
    }

    /// @dev Compute current value of the entire position (USDC 6 dec)
    function _computeCurrentValue(OptionPosition storage pos) internal view returns (uint256 totalValue) {
        for (uint256 i = 0; i < pos.legCount; i++) {
            OptionLeg storage leg = pos.legs[i];
            uint256 spot    = indexEngine.getIndexPrice(leg.marketId);
            uint256 iv      = volSurface.getIV(leg.marketId, leg.strike, leg.optionType == OptionType.CALL);

            // Time decay: simple linear decay from 100% to 50% over 30 days
            uint256 age         = block.timestamp - pos.openedAt;
            uint256 decayFactor = _timeDecay(age);

            uint256 notionalUsdc = leg.notional.mulWad(spot) / USDC_SCALE;
            uint256 intrinsicUsdc;

            if (leg.optionType == OptionType.CALL) {
                if (spot > leg.strike) {
                    uint256 intrinsicPct = (spot - leg.strike).mulWad(WAD) / spot;
                    intrinsicUsdc = notionalUsdc.mulWad(intrinsicPct);
                }
            } else {
                if (leg.strike > spot) {
                    uint256 intrinsicPct = (leg.strike - spot).mulWad(WAD) / leg.strike;
                    intrinsicUsdc = notionalUsdc.mulWad(intrinsicPct);
                }
            }

            uint256 timeValueUsdc = notionalUsdc.mulWad(_atmPremiumPct(iv)).mulWad(decayFactor);

            uint256 legValue = intrinsicUsdc + timeValueUsdc;

            if (leg.side == OptionSide.LONG) {
                totalValue += legValue;
            } else {
                // Short side: value is the collateral minus liability to buyer
                uint256 initNotionalUsdc = leg.notional.mulWad(leg.strike) / USDC_SCALE;
                uint256 sellerCollateral = initNotionalUsdc.mulWad(WAD + SELLER_BUFFER);
                totalValue += sellerCollateral > legValue ? sellerCollateral - legValue : 0;
            }
        }
    }

    /// @dev Time decay factor: starts at WAD (100%), decays toward 5e17 (50%) over 30 days
    function _timeDecay(uint256 age) internal pure returns (uint256) {
        uint256 thirtyDays = 30 days;
        if (age >= thirtyDays) return 5e17; // minimum 50%
        // Linear decay: 1 - 0.5 * (age / 30days)
        uint256 decayAmount = (5e17 * age) / thirtyDays;
        return WAD - decayAmount;
    }

    /// @dev Compute payout for position burn
    function _computePayout(
        OptionPosition storage pos,
        uint256 currentValue
    ) internal view returns (uint256) {
        // Payout = min(currentValue, collateralLocked)
        return currentValue < pos.collateralLocked ? currentValue : pos.collateralLocked;
    }

    // ============================================
    // INTERNAL — POSITION TRACKING
    // ============================================

    /// @dev Return amount of collateral locked as seller collateral for LP accounting
    function _getSellerLocked(OptionPosition storage pos) internal view returns (uint256 total) {
        for (uint256 i = 0; i < pos.legCount; i++) {
            if (pos.legs[i].side == OptionSide.SHORT) {
                uint256 spot = indexEngine.getIndexPrice(pos.legs[i].marketId);
                uint256 notionalUsdc = pos.legs[i].notional.mulWad(spot) / USDC_SCALE;
                uint256 iv = volSurface.getIV(pos.legs[i].marketId, pos.legs[i].strike, pos.legs[i].optionType == OptionType.CALL);
                uint256 premPct = _atmPremiumPct(iv);
                total += notionalUsdc.mulWad(WAD + SELLER_BUFFER) + notionalUsdc.mulWad(premPct);
            }
        }
    }

    function _removePosition(bytes32 positionId, address trader) internal {
        bytes32[] storage arr   = traderOptions[trader];
        uint256   idx           = _positionIndex[positionId];
        uint256   lastIdx       = arr.length - 1;

        if (idx != lastIdx) {
            bytes32 lastId = arr[lastIdx];
            arr[idx]       = lastId;
            _positionIndex[lastId] = idx;
        }

        arr.pop();
        delete _positionIndex[positionId];
        delete optionPositions[positionId];
    }

    // ============================================
    // ADMIN
    // ============================================

    function registerMarket(bytes32 marketId) external onlyOwner {
        registeredMarkets[marketId] = true;
    }

    function setVolSurface(address _volSurface) external onlyOwner {
        volSurface = VolSurface(_volSurface);
    }

    function setIndexEngine(address _indexEngine) external onlyOwner {
        indexEngine = IIndexEngine(_indexEngine);
    }

    function setCollateralTracker(address _tracker) external onlyOwner {
        collateralTracker = AurocCollateralTracker(_tracker);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
