// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Auction, PositionEquity } from "../types/DataTypes.sol";

/// @title ILiquidationEngine
/// @notice Interface for liquidation management with Dutch auctions
interface ILiquidationEngine {
    // ============================================
    // EVENTS
    // ============================================

    event LiquidationStarted(
        bytes32 indexed auctionId,
        bytes32 indexed positionId,
        address indexed trader,
        int256 size,
        uint256 startPrice,
        uint256 endPrice
    );
    event AuctionFilled(
        bytes32 indexed auctionId,
        address indexed filler,
        int256 fillSize,
        uint256 fillPrice,
        uint256 profit
    );
    event AuctionCompleted(bytes32 indexed auctionId, int256 totalFilled);
    event AuctionCancelled(bytes32 indexed auctionId, string reason);
    event BackstopTriggered(bytes32 indexed positionId, uint256 shortfall);
    event InsuranceUsed(bytes32 indexed positionId, uint256 amount);
    event LossSocialized(bytes32 indexed positionId, uint256 amount);

    // ============================================
    // ERRORS
    // ============================================

    error PositionNotLiquidatable();
    error AuctionNotFound();
    error AuctionNotActive();
    error AuctionExpired();
    error InvalidFillSize();
    error InsufficientFillAmount();
    error Unauthorized();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Check if a position is liquidatable
    /// @param positionId Position ID
    /// @return liquidatable True if E < MMR
    /// @return equity Position equity struct
    function checkLiquidatable(bytes32 positionId)
        external
        view
        returns (bool liquidatable, PositionEquity memory equity);

    /// @notice Get auction details
    /// @param auctionId Auction ID
    /// @return Auction struct
    function getAuction(bytes32 auctionId) external view returns (Auction memory);

    /// @notice Get current auction price
    /// @param auctionId Auction ID
    /// @return Current price based on time decay
    function getCurrentAuctionPrice(bytes32 auctionId) external view returns (uint256);

    /// @notice Get auction progress
    /// @param auctionId Auction ID
    /// @return elapsed Time elapsed
    /// @return remaining Time remaining
    /// @return percentComplete Completion percentage (WAD)
    function getAuctionProgress(bytes32 auctionId)
        external
        view
        returns (uint256 elapsed, uint256 remaining, uint256 percentComplete);

    /// @notice Get all active auctions for a market
    /// @param marketId Market identifier
    /// @return Array of auction IDs
    function getActiveAuctions(bytes32 marketId) external view returns (bytes32[] memory);

    /// @notice Get all active auctions
    /// @return Array of auction IDs
    function getAllActiveAuctions() external view returns (bytes32[] memory);

    /// @notice Check if position has active auction
    /// @param positionId Position ID
    /// @return True if auction is active
    function hasActiveAuction(bytes32 positionId) external view returns (bool);

    /// @notice Calculate keeper profit for filling an auction
    /// @param auctionId Auction ID
    /// @param fillSize Size to fill
    /// @return profit Expected profit
    /// @return fillPrice Current fill price
    function calculateKeeperProfit(bytes32 auctionId, int256 fillSize)
        external
        view
        returns (uint256 profit, uint256 fillPrice);

    // ============================================
    // LIQUIDATION ACTIONS
    // ============================================

    /// @notice Start liquidation auction for a position
    /// @param positionId Position ID
    /// @return auctionId New auction ID
    function startLiquidation(bytes32 positionId) external returns (bytes32 auctionId);

    /// @notice Fill (part of) an auction
    /// @param auctionId Auction ID
    /// @param fillSize Size to fill (must match position direction)
    /// @dev Keeper takes over the position at current auction price
    function fillAuction(bytes32 auctionId, int256 fillSize) external;

    /// @notice Trigger backstop for insolvent position
    /// @param positionId Position ID
    /// @dev Called when E < -buffer, skips auction
    function backstopLiquidation(bytes32 positionId) external;

    /// @notice Cancel expired auction
    /// @param auctionId Auction ID
    function cancelAuction(bytes32 auctionId) external;

    // ============================================
    // CONFIG
    // ============================================

    /// @notice Set auction parameters
    /// @param duration Auction duration in seconds
    /// @param startPenalty Start penalty (WAD, e.g., 0.02e18 = 2%)
    /// @param endPenalty End penalty (WAD, e.g., 0.10e18 = 10%)
    function setAuctionParams(
        uint256 duration,
        uint256 startPenalty,
        uint256 endPenalty
    ) external;

    /// @notice Set maintenance margin parameters
    /// @param mmrBase Base maintenance margin rate (WAD)
    /// @param mmrMultiplierMax Max multiplier for dynamic MMR (WAD)
    function setMMRParams(uint256 mmrBase, uint256 mmrMultiplierMax) external;

    /// @notice Set insolvency buffer
    /// @param buffer Buffer before backstop triggers (WAD)
    function setInsolvencyBuffer(uint256 buffer) external;

    /// @notice Set chunk size for partial liquidations
    /// @param chunkSize Fraction of position per chunk (WAD)
    function setChunkSize(uint256 chunkSize) external;
}
