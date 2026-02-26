// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Position, PositionEquity } from "../types/DataTypes.sol";

/// @title IPerpEngine
/// @notice Interface for perpetual trading engine
interface IPerpEngine {
    // ============================================
    // EVENTS
    // ============================================

    event PositionOpened(
        bytes32 indexed positionId,
        address indexed trader,
        bytes32 indexed marketId,
        int256 size,
        uint256 entryPrice,
        uint256 margin
    );
    event PositionModified(
        bytes32 indexed positionId,
        int256 sizeDelta,
        uint256 newSize,
        uint256 newEntryPrice,
        uint256 newMargin
    );
    event PositionClosed(
        bytes32 indexed positionId,
        address indexed trader,
        int256 realizedPnL,
        uint256 exitPrice
    );
    event MarginAdded(bytes32 indexed positionId, uint256 amount, uint256 newMargin);
    event MarginRemoved(bytes32 indexed positionId, uint256 amount, uint256 newMargin);
    event FundingPaid(bytes32 indexed positionId, int256 fundingAmount);

    // ============================================
    // ERRORS
    // ============================================

    error PositionNotFound();
    error InsufficientMargin();
    error ExceedsLeverage();
    error ExceedsOICap();
    error TradeNotAllowed();
    error SlippageExceeded();
    error ZeroSize();
    error PositionAlreadyExists();
    error NotPositionOwner();
    error MarketNotActive();
    error CannotReduceMarginBelowMaintenance();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get position by ID
    /// @param positionId Position identifier
    /// @return Position struct
    function getPosition(bytes32 positionId) external view returns (Position memory);

    /// @notice Get position equity breakdown
    /// @param positionId Position identifier
    /// @return PositionEquity struct
    function getPositionEquity(bytes32 positionId) external view returns (PositionEquity memory);

    /// @notice Get all positions for a trader
    /// @param trader Trader address
    /// @return Array of position IDs
    function getTraderPositions(address trader) external view returns (bytes32[] memory);

    /// @notice Get execution price for a trade
    /// @param marketId Market identifier
    /// @param sizeDelta Size change (positive for long, negative for short)
    /// @return executionPrice Price including spread and impact
    /// @return spread Spread component
    /// @return impact Impact component
    function getExecutionPrice(
        bytes32 marketId,
        int256 sizeDelta
    ) external view returns (uint256 executionPrice, uint256 spread, uint256 impact);

    /// @notice Calculate position ID
    /// @param trader Trader address
    /// @param marketId Market identifier
    /// @return Position ID
    function getPositionId(address trader, bytes32 marketId) external pure returns (bytes32);

    /// @notice Check if position exists
    /// @param positionId Position ID
    /// @return True if exists
    function positionExists(bytes32 positionId) external view returns (bool);

    // ============================================
    // TRADING
    // ============================================

    /// @notice Open a new position
    /// @param marketId Market identifier
    /// @param sizeDelta Position size (positive = long, negative = short)
    /// @param margin Collateral amount
    /// @param maxSlippage Max acceptable slippage (WAD, e.g., 0.01e18 = 1%)
    /// @return positionId New position ID
    function openPosition(
        bytes32 marketId,
        int256 sizeDelta,
        uint256 margin,
        uint256 maxSlippage
    ) external returns (bytes32 positionId);

    /// @notice Modify an existing position (increase/decrease)
    /// @param positionId Position ID
    /// @param sizeDelta Size change
    /// @param marginDelta Margin change (positive to add, negative to remove)
    /// @param maxSlippage Max acceptable slippage
    function modifyPosition(
        bytes32 positionId,
        int256 sizeDelta,
        int256 marginDelta,
        uint256 maxSlippage
    ) external;

    /// @notice Close a position entirely
    /// @param positionId Position ID
    /// @param minReceived Minimum collateral to receive after fees/PnL
    function closePosition(bytes32 positionId, uint256 minReceived) external;

    /// @notice Add margin to a position
    /// @param positionId Position ID
    /// @param amount Margin to add
    function addMargin(bytes32 positionId, uint256 amount) external;

    /// @notice Remove margin from a position
    /// @param positionId Position ID
    /// @param amount Margin to remove
    function removeMargin(bytes32 positionId, uint256 amount) external;

    // ============================================
    // LIQUIDATION INTERFACE
    // ============================================

    /// @notice Liquidate a position (called by LiquidationEngine)
    /// @param positionId Position ID
    /// @param liquidator Address receiving liquidation reward
    /// @param fillSize Size being liquidated
    /// @param fillPrice Auction fill price
    /// @return remainingSize Remaining position size
    /// @return pnl Realized PnL
    function liquidatePosition(
        bytes32 positionId,
        address liquidator,
        int256 fillSize,
        uint256 fillPrice
    ) external returns (int256 remainingSize, int256 pnl);

    // ============================================
    // FUNDING
    // ============================================

    /// @notice Apply funding to a position (called by FundingEngine)
    /// @param positionId Position ID
    function applyFunding(bytes32 positionId) external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Register a new market
    /// @param marketId Market identifier
    /// @param maxLeverage Max leverage (WAD)
    /// @param maxOI Max open interest (USD WAD)
    /// @param mmr Maintenance margin rate (WAD)
    /// @param takerFee Taker fee rate (WAD)
    /// @param makerFee Maker fee rate (WAD)
    function registerMarket(
        bytes32 marketId,
        uint256 maxLeverage,
        uint256 maxOI,
        uint256 mmr,
        uint256 takerFee,
        uint256 makerFee
    ) external;

    /// @notice Set market active status
    /// @param marketId Market identifier
    /// @param isActive Active status
    function setMarketActive(bytes32 marketId, bool isActive) external;
}
