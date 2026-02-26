// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IPerpEngine } from "../interfaces/IPerpEngine.sol";
import { IVault } from "../interfaces/IVault.sol";
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

/// @title PerpEngine
/// @notice Core perpetual trading engine - manages positions and executes trades
contract PerpEngine is IPerpEngine, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using MathLib for uint256;
    using MathLib for int256;

    // ============================================
    // CONSTANTS
    // ============================================

    uint256 public constant WAD = 1e18;

    // ============================================
    // STATE
    // ============================================

    /// @notice Collateral token (USDC)
    IERC20 public immutable collateral;

    /// @notice Vault for LP liquidity
    IVault public vault;

    /// @notice Index engine for prices and regime
    IIndexEngine public indexEngine;

    /// @notice Risk controller for params
    IRiskController public riskController;

    /// @notice Funding engine (optional, can be zero initially)
    IFundingEngine public fundingEngine;

    /// @notice All positions by ID
    mapping(bytes32 => Position) public positions;

    /// @notice Trader => position IDs
    mapping(address => bytes32[]) public traderPositions;

    /// @notice Position ID => index in traderPositions array
    mapping(bytes32 => uint256) internal _positionIndex;

    /// @notice Market configurations
    mapping(bytes32 => Market) public markets;

    /// @notice Market OI tracking
    mapping(bytes32 => int256) public marketOI;

    /// @notice Position nonce for unique IDs
    uint256 public positionNonce;

    /// @notice Authorized liquidators
    mapping(address => bool) public authorizedLiquidators;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _collateral,
        address _vault,
        address _indexEngine,
        address _riskController
    ) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
        vault = IVault(_vault);
        indexEngine = IIndexEngine(_indexEngine);
        riskController = IRiskController(_riskController);
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyLiquidator() {
        if (!authorizedLiquidators[msg.sender] && msg.sender != owner()) {
            revert NotPositionOwner(); // Reuse error
        }
        _;
    }

    // ============================================
    // VIEWS - IPerpEngine
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
        uint256 utilization = vault.getUtilization();

        // Get spread from risk controller
        spread = riskController.getEffectiveSpread(marketId, confidence, utilization, 0);

        // Get impact
        impact = riskController.calculateImpact(marketId, sizeDelta, marketOI[marketId]);

        // P_exec = P_index * (1 + sign(size) * spread + impact)
        int256 sign = MathLib.sign(sizeDelta);
        int256 adjustment = int256(spread) * sign + int256(impact);

        if (adjustment >= 0) {
            executionPrice = indexPrice.mulWad(WAD + uint256(adjustment));
        } else {
            uint256 discount = uint256(-adjustment);
            executionPrice = indexPrice.mulWad(WAD > discount ? WAD - discount : 0);
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
    // TRADING - IPerpEngine
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

        // Validate trade
        (bool allowed, string memory reason) = riskController.validateTrade(
            marketId,
            sizeDelta,
            margin,
            true // isIncrease
        );
        if (!allowed) revert TradeNotAllowed();

        // Get execution price
        (uint256 execPrice, , ) = getExecutionPrice(marketId, sizeDelta);

        // Check slippage
        uint256 indexPrice = indexEngine.getIndexPrice(marketId);
        uint256 slippage = execPrice > indexPrice
            ? ((execPrice - indexPrice) * WAD) / indexPrice
            : ((indexPrice - execPrice) * WAD) / indexPrice;
        if (slippage > maxSlippage) revert SlippageExceeded();

        // Check leverage
        uint256 notional = MathLib.abs(sizeDelta).mulWad(execPrice);
        RiskParams memory riskParams = riskController.getRiskParams(marketId);
        if (margin == 0 || (notional * WAD / margin) > riskParams.effectiveLeverage) {
            revert ExceedsLeverage();
        }

        // Transfer margin from trader
        collateral.safeTransferFrom(msg.sender, address(vault), margin);

        // Lock collateral in vault
        vault.lockCollateral(margin);

        // Get current cumulative funding
        int256 fundingAccum = 0;
        if (address(fundingEngine) != address(0)) {
            fundingAccum = fundingEngine.getCumulativeFunding(marketId);
        }

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

        // Update OI
        marketOI[marketId] += sizeDelta;
        riskController.updateOI(marketId, marketOI[marketId]);

        // Calculate fees
        uint256 fee = _calculateFee(marketId, notional, true);
        if (fee > 0) {
            vault.collectFees(marketId, fee);
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

        // Apply pending funding first
        _applyFunding(positionId);

        bool isIncrease = (sizeDelta > 0 && pos.size > 0) || (sizeDelta < 0 && pos.size < 0);

        // Validate trade
        uint256 newMargin = marginDelta >= 0
            ? pos.margin + uint256(marginDelta)
            : pos.margin - uint256(-marginDelta);

        (bool allowed, ) = riskController.validateTrade(
            pos.marketId,
            sizeDelta,
            newMargin,
            isIncrease
        );
        if (!allowed) revert TradeNotAllowed();

        // Handle margin changes
        if (marginDelta > 0) {
            collateral.safeTransferFrom(msg.sender, address(vault), uint256(marginDelta));
            vault.lockCollateral(uint256(marginDelta));
            pos.margin += uint256(marginDelta);
        } else if (marginDelta < 0) {
            // Check if removal is safe
            PositionEquity memory eq = _computeEquity(positionId);
            uint256 removal = uint256(-marginDelta);
            if (int256(pos.margin) - int256(removal) < int256(eq.maintenanceReq)) {
                revert CannotReduceMarginBelowMaintenance();
            }
            vault.unlockCollateral(removal);
            pos.margin -= removal;
            // Transfer to trader would happen via settlePnL logic
        }

        // Handle size changes
        if (sizeDelta != 0) {
            (uint256 execPrice, , ) = getExecutionPrice(pos.marketId, sizeDelta);

            // Check slippage
            uint256 indexPrice = indexEngine.getIndexPrice(pos.marketId);
            uint256 slippage = execPrice > indexPrice
                ? ((execPrice - indexPrice) * WAD) / indexPrice
                : ((indexPrice - execPrice) * WAD) / indexPrice;
            if (slippage > maxSlippage) revert SlippageExceeded();

            // Update entry price as weighted average
            int256 newSize = pos.size + sizeDelta;
            if (newSize != 0 && MathLib.sign(newSize) == MathLib.sign(pos.size)) {
                // Same direction - average entry
                uint256 oldNotional = MathLib.abs(pos.size).mulWad(pos.entryPrice);
                uint256 newNotional = MathLib.abs(sizeDelta).mulWad(execPrice);
                pos.entryPrice = (oldNotional + newNotional) / MathLib.abs(newSize);
            } else {
                // Direction change - use new price for new direction
                pos.entryPrice = execPrice;
            }

            pos.size = newSize;
            marketOI[pos.marketId] += sizeDelta;
            riskController.updateOI(pos.marketId, marketOI[pos.marketId]);
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

        collateral.safeTransferFrom(msg.sender, address(vault), amount);
        vault.lockCollateral(amount);
        pos.margin += amount;
        pos.lastUpdated = block.timestamp;

        emit MarginAdded(positionId, amount, pos.margin);
    }

    /// @inheritdoc IPerpEngine
    function removeMargin(bytes32 positionId, uint256 amount) external override nonReentrant {
        Position storage pos = positions[positionId];
        if (pos.size == 0) revert PositionNotFound();
        if (pos.trader != msg.sender) revert NotPositionOwner();

        // Apply funding first
        _applyFunding(positionId);

        // Check safety
        PositionEquity memory eq = _computeEquity(positionId);
        if (int256(pos.margin) - int256(amount) < int256(eq.maintenanceReq)) {
            revert CannotReduceMarginBelowMaintenance();
        }

        vault.unlockCollateral(amount);
        pos.margin -= amount;
        pos.lastUpdated = block.timestamp;

        // Transfer to trader
        collateral.safeTransfer(msg.sender, amount);

        emit MarginRemoved(positionId, amount, pos.margin);
    }

    // ============================================
    // LIQUIDATION INTERFACE - IPerpEngine
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

        // Apply funding
        _applyFunding(positionId);

        // Calculate PnL for the filled portion
        int256 priceDiff = int256(fillPrice) - int256(pos.entryPrice);
        int256 sizeFilled = fillSize > 0 ? fillSize : -fillSize;
        pnl = (priceDiff * sizeFilled) / int256(WAD);

        // Update position
        pos.size -= fillSize;
        remainingSize = pos.size;

        // Update OI
        marketOI[pos.marketId] -= fillSize;
        riskController.updateOI(pos.marketId, marketOI[pos.marketId]);

        // If fully liquidated, clean up
        if (pos.size == 0) {
            _removePosition(positionId, pos.trader);
        }

        pos.lastUpdated = block.timestamp;

        return (remainingSize, pnl);
    }

    // ============================================
    // FUNDING - IPerpEngine
    // ============================================

    /// @inheritdoc IPerpEngine
    function applyFunding(bytes32 positionId) external override {
        _applyFunding(positionId);
    }

    // ============================================
    // CONFIG - IPerpEngine
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
            symbol: "", // Set separately if needed
            maxLeverage: maxLeverage,
            maxOI: maxOI,
            maintenanceMargin: mmr,
            takerFee: takerFee,
            makerFee: makerFee,
            isActive: true
        });

        // Register with index engine if needed
        // indexEngine.registerMarket(marketId, Regime.OFF_HOURS);
    }

    /// @inheritdoc IPerpEngine
    function setMarketActive(bytes32 marketId, bool isActive) external override onlyOwner {
        markets[marketId].isActive = isActive;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Set funding engine
    function setFundingEngine(address _fundingEngine) external onlyOwner {
        fundingEngine = IFundingEngine(_fundingEngine);
    }

    /// @notice Set authorized liquidator
    function setAuthorizedLiquidator(address liquidator, bool authorized) external onlyOwner {
        authorizedLiquidators[liquidator] = authorized;
    }

    /// @notice Set vault
    function setVault(address _vault) external onlyOwner {
        vault = IVault(_vault);
    }

    /// @notice Pause
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Compute position equity
    function _computeEquity(bytes32 positionId) internal view returns (PositionEquity memory) {
        Position storage pos = positions[positionId];
        Market storage market = markets[pos.marketId];

        uint256 markPrice = indexEngine.getMarkPrice(pos.marketId);

        // Unrealized PnL
        int256 priceDiff = int256(markPrice) - int256(pos.entryPrice);
        int256 unrealizedPnL = (priceDiff * pos.size) / int256(WAD);

        // Funding PnL
        int256 fundingPnL = 0;
        if (address(fundingEngine) != address(0)) {
            int256 currentFunding = fundingEngine.getCumulativeFunding(pos.marketId);
            int256 fundingDelta = currentFunding - pos.fundingAccum;
            fundingPnL = -(fundingDelta * pos.size) / int256(WAD);
        }

        // Total equity
        int256 totalEquity = int256(pos.margin) + unrealizedPnL + fundingPnL;

        // Maintenance requirement
        uint256 notional = MathLib.abs(pos.size).mulWad(markPrice);
        uint256 mmr = notional.mulWad(market.maintenanceMargin);

        bool isLiquidatable = totalEquity < int256(mmr);
        bool isInsolvent = totalEquity < -int256(notional / 100); // -1% buffer

        return PositionEquity({
            unrealizedPnL: unrealizedPnL,
            fundingPnL: fundingPnL,
            totalEquity: totalEquity,
            maintenanceReq: mmr,
            isLiquidatable: isLiquidatable,
            isInsolvent: isInsolvent
        });
    }

    /// @dev Apply pending funding to a position
    function _applyFunding(bytes32 positionId) internal {
        if (address(fundingEngine) == address(0)) return;

        Position storage pos = positions[positionId];
        int256 currentFunding = fundingEngine.getCumulativeFunding(pos.marketId);
        int256 fundingDelta = currentFunding - pos.fundingAccum;

        if (fundingDelta != 0) {
            int256 fundingAmount = -(fundingDelta * pos.size) / int256(WAD);

            // Update position's funding accumulator
            pos.fundingAccum = currentFunding;

            // Adjust margin
            if (fundingAmount > 0) {
                // Position receives funding
                pos.margin += uint256(fundingAmount);
            } else {
                // Position pays funding
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

    /// @dev Close position internal logic
    function _closePositionInternal(
        bytes32 positionId,
        int256 closeSize,
        address recipient,
        uint256 minReceived
    ) internal {
        Position storage pos = positions[positionId];

        // Apply funding
        _applyFunding(positionId);

        // Get close price (opposite direction)
        (uint256 closePrice, , ) = getExecutionPrice(pos.marketId, -closeSize);

        // Calculate PnL
        int256 priceDiff = int256(closePrice) - int256(pos.entryPrice);
        int256 pnl = (priceDiff * closeSize) / int256(WAD);

        // Calculate fee
        uint256 notional = MathLib.abs(closeSize).mulWad(closePrice);
        uint256 fee = _calculateFee(pos.marketId, notional, false);

        // Net return to trader
        int256 netReturn = int256(pos.margin) + pnl - int256(fee);

        // Check min received
        if (netReturn > 0 && uint256(netReturn) < minReceived) {
            revert SlippageExceeded();
        }

        // Unlock collateral
        vault.unlockCollateral(pos.margin);

        // Settle PnL with vault
        vault.settlePnL(pos.marketId, recipient, pnl - int256(fee));

        // Collect fee
        if (fee > 0) {
            vault.collectFees(pos.marketId, fee);
        }

        // Update OI
        marketOI[pos.marketId] -= closeSize;
        riskController.updateOI(pos.marketId, marketOI[pos.marketId]);

        // Remove position
        _removePosition(positionId, pos.trader);

        emit PositionClosed(positionId, recipient, pnl, closePrice);
    }

    /// @dev Remove position from storage
    function _removePosition(bytes32 positionId, address trader) internal {
        // Remove from trader's position array
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

    /// @dev Calculate trading fee
    function _calculateFee(
        bytes32 marketId,
        uint256 notional,
        bool isTaker
    ) internal view returns (uint256) {
        Market storage market = markets[marketId];
        uint256 feeRate = isTaker ? market.takerFee : market.makerFee;
        return notional.mulWad(feeRate);
    }
}
