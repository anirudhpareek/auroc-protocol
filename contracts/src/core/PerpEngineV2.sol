// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPerpEngine } from "../interfaces/IPerpEngine.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { IRiskController } from "../interfaces/IRiskController.sol";
import { IFundingEngine } from "../interfaces/IFundingEngine.sol";
import { Position, PositionEquity, Market, RiskParams } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

// New imports for enhanced features
import { LiquidityBuffer } from "./LiquidityBuffer.sol";
import { SkewManager } from "../engines/SkewManager.sol";
import { PremiaCalculator } from "../engines/PremiaCalculator.sol";

/// @title PerpEngineV2
/// @notice Enhanced perpetual trading engine with:
///         - Two-tier liquidity (Ostium-style buffer)
///         - OI skew incentives (Avantis-style rebates & positive slippage)
///         - Risk-based premia (Vest-style pricing)
contract PerpEngineV2 is IPerpEngine, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE - Core Dependencies
    // ============================================

    IERC20 public immutable collateral;
    IIndexEngine public indexEngine;
    IRiskController public riskController;
    IFundingEngine public fundingEngine;

    // ============================================
    // STATE - Enhanced Components
    // ============================================

    /// @notice Two-tier liquidity: Buffer takes first loss
    LiquidityBuffer public liquidityBuffer;

    /// @notice Skew incentives: rebates and positive slippage
    SkewManager public skewManager;

    /// @notice Risk-based pricing
    PremiaCalculator public premiaCalculator;

    // ============================================
    // STATE - Positions
    // ============================================

    mapping(bytes32 => Position) public positions;
    mapping(address => bytes32[]) public traderPositions;
    mapping(bytes32 => uint256) internal _positionIndex;
    mapping(bytes32 => Market) public markets;
    mapping(bytes32 => int256) public marketOI;
    uint256 public positionNonce;
    mapping(address => bool) public authorizedLiquidators;

    // ============================================
    // EVENTS - Enhanced
    // ============================================

    event PositiveSlippageApplied(bytes32 indexed positionId, uint256 slippageReward);
    event LossRebatePaid(bytes32 indexed positionId, address indexed trader, uint256 rebateAmount);
    event PremiaCharged(bytes32 indexed positionId, uint256 premia, bool wasRiskReducing);

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _collateral,
        address _liquidityBuffer,
        address _indexEngine,
        address _riskController,
        address _skewManager,
        address _premiaCalculator
    ) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
        liquidityBuffer = LiquidityBuffer(_liquidityBuffer);
        indexEngine = IIndexEngine(_indexEngine);
        riskController = IRiskController(_riskController);
        skewManager = SkewManager(_skewManager);
        premiaCalculator = PremiaCalculator(_premiaCalculator);
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyLiquidator() {
        if (!authorizedLiquidators[msg.sender] && msg.sender != owner()) {
            revert NotPositionOwner();
        }
        _;
    }

    // ============================================
    // VIEWS
    // ============================================

    /// @inheritdoc IPerpEngine
    function getPosition(bytes32 positionId) external view override returns (Position memory) {
        return positions[positionId];
    }

    /// @inheritdoc IPerpEngine
    function getPositionEquity(bytes32 positionId) external view override returns (PositionEquity memory) {
        return _computeEquity(positionId);
    }

    /// @inheritdoc IPerpEngine
    function getTraderPositions(address trader) external view override returns (bytes32[] memory) {
        return traderPositions[trader];
    }

    /// @inheritdoc IPerpEngine
    function getExecutionPrice(
        bytes32 marketId,
        int256 sizeDelta
    ) public view override returns (uint256 executionPrice, uint256 spread, uint256 impact) {
        uint256 indexPrice = indexEngine.getIndexPrice(marketId);
        uint256 confidence = indexEngine.getConfidence(marketId);
        uint256 utilization = liquidityBuffer.getCollateralizationRatio();

        // Base spread from risk controller
        spread = riskController.getEffectiveSpread(marketId, confidence, utilization, 0);

        // Calculate risk-based premia (Vest-style)
        uint256 notional = MathLib.abs(sizeDelta).mulWad(indexPrice);
        (uint256 premia, bool isRiskReducing) = premiaCalculator.calculatePremia(marketId, sizeDelta, notional);

        // Calculate positive slippage reward (Avantis-style)
        uint256 positiveSlippage = skewManager.calculatePositiveSlippage(marketId, sizeDelta);

        // Combine all components
        int256 sign = MathLib.sign(sizeDelta);

        if (isRiskReducing && positiveSlippage > 0) {
            // Risk-reducing trade: reduce spread, apply positive slippage
            if (spread > positiveSlippage) {
                spread = spread - positiveSlippage;
            } else {
                spread = 0;
            }
            // Negative premia means better price
            impact = 0;
        } else {
            // Risk-increasing trade: add premia as impact
            impact = premia;
        }

        // Calculate final execution price
        int256 totalAdjustment = int256(spread) * sign + int256(impact) * sign;

        if (totalAdjustment >= 0) {
            executionPrice = indexPrice.mulWad(WAD + uint256(totalAdjustment));
        } else {
            uint256 discount = uint256(-totalAdjustment);
            executionPrice = indexPrice.mulWad(WAD > discount ? WAD - discount : WAD);
        }

        return (executionPrice, spread, impact);
    }

    /// @inheritdoc IPerpEngine
    function getPositionId(address trader, bytes32 marketId) public pure override returns (bytes32) {
        return keccak256(abi.encodePacked(trader, marketId));
    }

    /// @inheritdoc IPerpEngine
    function positionExists(bytes32 positionId) public view override returns (bool) {
        return positions[positionId].size != 0;
    }

    // ============================================
    // TRADING
    // ============================================

    /// @inheritdoc IPerpEngine
    function openPosition(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 margin,
        uint256 maxSlippage
    ) external override nonReentrant whenNotPaused returns (bytes32 positionId) {
        if (sizeDelta == 0) revert ZeroSize();
        if (!markets[marketId].isActive) revert MarketNotActive();

        positionId = getPositionId(msg.sender, marketId);
        if (positionExists(positionId)) revert PositionAlreadyExists();

        // Validate trade via risk controller
        (bool allowed, string memory reason) = riskController.validateTrade(marketId, sizeDelta, margin, true);
        if (!allowed) revert TradeNotAllowed();

        // Get execution price (includes premia and positive slippage)
        (uint256 execPrice, uint256 spread, uint256 impact) = getExecutionPrice(marketId, sizeDelta);

        // Check slippage
        uint256 indexPrice = indexEngine.getIndexPrice(marketId);
        uint256 slippage = execPrice > indexPrice
            ? ((execPrice - indexPrice) * WAD) / indexPrice
            : ((indexPrice - execPrice) * WAD) / indexPrice;
        if (slippage > maxSlippage) revert SlippageExceeded();

        // Check leverage
        uint256 notional = MathLib.abs(sizeDelta).mulWad(execPrice);
        RiskParams memory riskParams = riskController.getRiskParams(marketId);
        // Scale margin from 6 decimals (USDC) to WAD (18 decimals) for leverage calculation
        uint256 marginWAD = margin * 1e12;
        if (margin == 0 || (notional * WAD / marginWAD) > riskParams.effectiveLeverage) {
            revert ExceedsLeverage();
        }

        // Transfer margin to liquidity buffer (not vault)
        collateral.safeTransferFrom(msg.sender, address(liquidityBuffer), margin);
        liquidityBuffer.notifyMarginReceived(margin);

        // Lock rebate eligibility (Avantis-style)
        skewManager.lockRebateEligibility(positionId, marketId, sizeDelta);

        // Get current cumulative funding
        int256 fundingAccum = address(fundingEngine) != address(0)
            ? fundingEngine.getCumulativeFunding(marketId)
            : int256(0);

        // Create position
        positions[positionId] = Position({
            positionId: positionId,
            trader: msg.sender,
            marketId: marketId,
            size: sizeDelta,
            entryPrice: execPrice,
            margin: margin,
            fundingAccum: fundingAccum,
            openedAt: block.timestamp,
            lastUpdated: block.timestamp
        });

        // Track position
        traderPositions[msg.sender].push(positionId);
        _positionIndex[positionId] = traderPositions[msg.sender].length - 1;

        // Update OI tracking
        marketOI[marketId] += sizeDelta;
        riskController.updateOI(marketId, marketOI[marketId]);
        skewManager.updateOI(marketId, sizeDelta);
        premiaCalculator.updatePortfolio(marketId, sizeDelta, notional);

        // Calculate and collect fees
        uint256 fee = _calculateFee(marketId, notional, true);
        if (fee > 0) {
            liquidityBuffer.accumulateFees(marketId, fee);
        }

        // Emit premia event if charged
        if (impact > 0) {
            emit PremiaCharged(positionId, impact, false);
        }

        emit PositionOpened(positionId, msg.sender, marketId, sizeDelta, execPrice, margin);

        return positionId;
    }

    /// @inheritdoc IPerpEngine
    function modifyPosition(
        bytes32 positionId,
        int256 sizeDelta,
        int256 marginDelta,
        uint256 maxSlippage
    ) external override nonReentrant whenNotPaused {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();
        if (pos.trader != msg.sender) revert NotPositionOwner();

        _applyFunding(positionId);

        bool isIncrease = (sizeDelta > 0 && pos.size > 0) || (sizeDelta < 0 && pos.size < 0);

        uint256 newMargin = marginDelta >= 0
            ? pos.margin + uint256(marginDelta)
            : pos.margin - uint256(-marginDelta);

        (bool allowed, ) = riskController.validateTrade(pos.marketId, sizeDelta, newMargin, isIncrease);
        if (!allowed) revert TradeNotAllowed();

        // Handle margin changes
        if (marginDelta > 0) {
            collateral.safeTransferFrom(msg.sender, address(liquidityBuffer), uint256(marginDelta));
            liquidityBuffer.notifyMarginReceived(uint256(marginDelta));
            pos.margin += uint256(marginDelta);
        } else if (marginDelta < 0) {
            PositionEquity memory eq = _computeEquity(positionId);
            uint256 removal = uint256(-marginDelta);
            if (int256(pos.margin) - int256(removal) < int256(eq.maintenanceReq)) {
                revert CannotReduceMarginBelowMaintenance();
            }
            liquidityBuffer.returnMargin(msg.sender, removal);
            pos.margin -= removal;
        }

        // Handle size changes
        if (sizeDelta != 0) {
            (uint256 execPrice, , uint256 premia) = getExecutionPrice(pos.marketId, sizeDelta);

            uint256 indexPrice = indexEngine.getIndexPrice(pos.marketId);
            uint256 slippage = execPrice > indexPrice
                ? ((execPrice - indexPrice) * WAD) / indexPrice
                : ((indexPrice - execPrice) * WAD) / indexPrice;
            if (slippage > maxSlippage) revert SlippageExceeded();

            int256 newSize = pos.size + sizeDelta;
            if (newSize != 0 && MathLib.sign(newSize) == MathLib.sign(pos.size)) {
                uint256 oldNotional = MathLib.abs(pos.size).mulWad(pos.entryPrice);
                uint256 newNotional = MathLib.abs(sizeDelta).mulWad(execPrice);
                pos.entryPrice = (oldNotional + newNotional) / MathLib.abs(newSize);
            } else {
                pos.entryPrice = execPrice;
            }

            int256 oldSize = pos.size;
            pos.size = newSize;
            marketOI[pos.marketId] += sizeDelta;
            riskController.updateOI(pos.marketId, marketOI[pos.marketId]);

            uint256 notional = MathLib.abs(sizeDelta).mulWad(execPrice);

            // Properly track OI based on whether this is an increase or decrease
            if (isIncrease) {
                skewManager.updateOI(pos.marketId, sizeDelta);
                premiaCalculator.updatePortfolio(pos.marketId, sizeDelta, notional);
            } else {
                // Partial close - use close functions with the amount being closed
                // sizeDelta is opposite sign to oldSize, so we close |sizeDelta| worth
                skewManager.closeOI(pos.marketId, -sizeDelta);
                premiaCalculator.closePortfolio(pos.marketId, -sizeDelta, notional);
            }

            if (premia > 0) {
                emit PremiaCharged(positionId, premia, false);
            }
        }

        pos.lastUpdated = block.timestamp;

        emit PositionModified(
            positionId,
            sizeDelta,
            uint256(MathLib.abs(pos.size)),
            pos.entryPrice,
            pos.margin
        );
    }

    /// @inheritdoc IPerpEngine
    function closePosition(bytes32 positionId, uint256 minReceived) external override nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();
        if (pos.trader != msg.sender) revert NotPositionOwner();

        _closePositionInternal(positionId, pos.size, msg.sender, minReceived);
    }

    /// @inheritdoc IPerpEngine
    function addMargin(bytes32 positionId, uint256 amount) external override nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();
        if (pos.trader != msg.sender) revert NotPositionOwner();
        if (amount == 0) revert ZeroSize();

        collateral.safeTransferFrom(msg.sender, address(liquidityBuffer), amount);
        liquidityBuffer.notifyMarginReceived(amount);
        pos.margin += amount;
        pos.lastUpdated = block.timestamp;

        emit MarginAdded(positionId, amount, pos.margin);
    }

    /// @inheritdoc IPerpEngine
    function removeMargin(bytes32 positionId, uint256 amount) external override nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();
        if (pos.trader != msg.sender) revert NotPositionOwner();

        _applyFunding(positionId);

        PositionEquity memory eq = _computeEquity(positionId);
        if (int256(pos.margin) - int256(amount) < int256(eq.maintenanceReq)) {
            revert CannotReduceMarginBelowMaintenance();
        }

        liquidityBuffer.returnMargin(msg.sender, amount);
        pos.margin -= amount;
        pos.lastUpdated = block.timestamp;

        emit MarginRemoved(positionId, amount, pos.margin);
    }

    // ============================================
    // LIQUIDATION
    // ============================================

    /// @inheritdoc IPerpEngine
    function liquidatePosition(
        bytes32 positionId,
        address liquidator,
        int256 fillSize,
        uint256 fillPrice
    ) external override onlyLiquidator returns (int256 remainingSize, int256 pnl) {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();

        _applyFunding(positionId);

        int256 priceDiff = int256(fillPrice) - int256(pos.entryPrice);
        int256 sizeFilled = fillSize > 0 ? fillSize : -fillSize;
        pnl = (priceDiff * sizeFilled) / int256(WAD);

        pos.size -= fillSize;
        remainingSize = pos.size;

        marketOI[pos.marketId] -= fillSize;
        riskController.updateOI(pos.marketId, marketOI[pos.marketId]);
        skewManager.closeOI(pos.marketId, fillSize); // Use closeOI for proper totalOI tracking

        if (pos.size == 0) {
            skewManager.clearRebateEligibility(positionId);
            _removePosition(positionId, pos.trader);
        }

        pos.lastUpdated = block.timestamp;

        return (remainingSize, pnl);
    }

    // ============================================
    // FUNDING
    // ============================================

    /// @inheritdoc IPerpEngine
    function applyFunding(bytes32 positionId) external override {
        _applyFunding(positionId);
    }

    // ============================================
    // CONFIG
    // ============================================

    /// @inheritdoc IPerpEngine
    function registerMarket(
        bytes32 marketId,
        uint256 maxLeverage,
        uint256 maxOI,
        uint256 mmr,
        uint256 takerFee,
        uint256 makerFee
    ) external override onlyOwner {
        markets[marketId] = Market({
            marketId: marketId,
            symbol: "",
            maxLeverage: maxLeverage,
            maxOI: maxOI,
            maintenanceMargin: mmr,
            takerFee: takerFee,
            makerFee: makerFee,
            isActive: true
        });
    }

    /// @inheritdoc IPerpEngine
    function setMarketActive(bytes32 marketId, bool isActive) external override onlyOwner {
        markets[marketId].isActive = isActive;
    }

    // ============================================
    // ADMIN
    // ============================================

    function setFundingEngine(address _fundingEngine) external onlyOwner {
        fundingEngine = IFundingEngine(_fundingEngine);
    }

    function setAuthorizedLiquidator(address liquidator, bool authorized) external onlyOwner {
        authorizedLiquidators[liquidator] = authorized;
    }

    function setLiquidityBuffer(address _buffer) external onlyOwner {
        liquidityBuffer = LiquidityBuffer(_buffer);
    }

    function setSkewManager(address _skewManager) external onlyOwner {
        skewManager = SkewManager(_skewManager);
    }

    function setPremiaCalculator(address _premiaCalculator) external onlyOwner {
        premiaCalculator = PremiaCalculator(_premiaCalculator);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // INTERNAL
    // ============================================

    function _computeEquity(bytes32 positionId) internal view returns (PositionEquity memory) {
        Position storage pos = positions[positionId];
        Market storage market = markets[pos.marketId];

        uint256 markPrice = indexEngine.getMarkPrice(pos.marketId);

        // Unrealized PnL (in WAD)
        int256 priceDiff = int256(markPrice) - int256(pos.entryPrice);
        int256 unrealizedPnL = (priceDiff * pos.size) / int256(WAD);

        // Funding PnL (in WAD)
        int256 fundingPnL = 0;
        if (address(fundingEngine) != address(0)) {
            int256 currentFunding = fundingEngine.getCumulativeFunding(pos.marketId);
            int256 fundingDelta = currentFunding - pos.fundingAccum;
            fundingPnL = -(fundingDelta * pos.size) / int256(WAD);
        }

        // Total equity (scale margin from 6 decimals to WAD for calculation)
        int256 marginWAD = int256(pos.margin) * 1e12;
        int256 totalEquity = marginWAD + unrealizedPnL + fundingPnL;

        // Maintenance requirement (in WAD)
        uint256 notional = MathLib.abs(pos.size).mulWad(markPrice);
        uint256 mmr = notional.mulWad(market.maintenanceMargin);

        bool isLiquidatable = totalEquity < int256(mmr);
        bool isInsolvent = totalEquity < -int256(notional / 100);

        return PositionEquity({
            unrealizedPnL: unrealizedPnL,
            fundingPnL: fundingPnL,
            totalEquity: totalEquity,
            maintenanceReq: mmr,
            isLiquidatable: isLiquidatable,
            isInsolvent: isInsolvent
        });
    }

    function _applyFunding(bytes32 positionId) internal {
        if (address(fundingEngine) == address(0)) return;

        Position storage pos = positions[positionId];
        int256 currentFunding = fundingEngine.getCumulativeFunding(pos.marketId);
        int256 fundingDelta = currentFunding - pos.fundingAccum;

        if (fundingDelta != 0) {
            int256 fundingAmount = -(fundingDelta * pos.size) / int256(WAD);
            pos.fundingAccum = currentFunding;

            if (fundingAmount > 0) {
                pos.margin += uint256(fundingAmount);
            } else {
                uint256 payment = uint256(-fundingAmount);
                if (payment > pos.margin) {
                    pos.margin = 0;
                } else {
                    pos.margin -= payment;
                }
            }

            emit FundingPaid(positionId, fundingAmount);
        }
    }

    function _closePositionInternal(
        bytes32 positionId,
        int256 closeSize,
        address recipient,
        uint256 minReceived
    ) internal {
        Position storage pos = positions[positionId];

        _applyFunding(positionId);

        (uint256 closePrice, , ) = getExecutionPrice(pos.marketId, -closeSize);

        int256 priceDiff = int256(closePrice) - int256(pos.entryPrice);
        int256 pnl = (priceDiff * closeSize) / int256(WAD);

        uint256 notional = MathLib.abs(closeSize).mulWad(closePrice);
        uint256 fee = _calculateFee(pos.marketId, notional, false);

        // Check for loss rebate (Avantis-style)
        uint256 rebate = 0;
        if (pnl < 0) {
            uint256 loss = uint256(-pnl);
            rebate = skewManager.calculateLossRebate(positionId, loss);
            if (rebate > 0) {
                skewManager.recordRebatePaid(positionId, recipient, rebate);
                emit LossRebatePaid(positionId, recipient, rebate);
            }
        }

        int256 netReturn = int256(pos.margin) + pnl - int256(fee) + int256(rebate);

        if (netReturn > 0 && uint256(netReturn) < minReceived) {
            revert SlippageExceeded();
        }

        // Settle through liquidity buffer (two-tier)
        // Pass full return amount (margin + pnl - fee + rebate)
        liquidityBuffer.settlePnL(pos.marketId, recipient, netReturn);

        // Update tracking
        marketOI[pos.marketId] -= closeSize;
        riskController.updateOI(pos.marketId, marketOI[pos.marketId]);
        skewManager.closeOI(pos.marketId, closeSize);
        skewManager.clearRebateEligibility(positionId);
        premiaCalculator.closePortfolio(pos.marketId, closeSize, notional);

        _removePosition(positionId, pos.trader);

        emit PositionClosed(positionId, recipient, pnl, closePrice);
    }

    function _removePosition(bytes32 positionId, address trader) internal {
        bytes32[] storage traderPosArray = traderPositions[trader];
        uint256 index = _positionIndex[positionId];
        uint256 lastIndex = traderPosArray.length - 1;

        if (index != lastIndex) {
            bytes32 lastPosId = traderPosArray[lastIndex];
            traderPosArray[index] = lastPosId;
            _positionIndex[lastPosId] = index;
        }

        traderPosArray.pop();
        delete _positionIndex[positionId];
        delete positions[positionId];
    }

    function _calculateFee(bytes32 marketId, uint256 notional, bool isTaker) internal view returns (uint256) {
        Market storage market = markets[marketId];
        uint256 feeRate = isTaker ? market.takerFee : market.makerFee;
        return notional.mulWad(feeRate);
    }
}
