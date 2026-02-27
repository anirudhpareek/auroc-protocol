// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { ILiquidationEngine } from "../interfaces/ILiquidationEngine.sol";
import { IPerpEngine } from "../interfaces/IPerpEngine.sol";
import { IIndexEngine } from "../interfaces/IIndexEngine.sol";
import { IVault } from "../interfaces/IVault.sol";
import { IInsuranceFund } from "../interfaces/IInsuranceFund.sol";
import { Auction, Position, PositionEquity } from "../types/DataTypes.sol";
import { MathLib } from "../libraries/MathLib.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LiquidationEngine
/// @notice Dutch auction liquidations with insurance fund backstop
contract LiquidationEngine is ILiquidationEngine, Ownable2Step, ReentrancyGuard {
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

    /// @notice Collateral token
    IERC20 public immutable collateral;

    /// @notice Perp engine
    IPerpEngine public perpEngine;

    /// @notice Index engine
    IIndexEngine public indexEngine;

    /// @notice Vault
    IVault public vault;

    /// @notice Insurance fund
    IInsuranceFund public insuranceFund;

    /// @notice Auction parameters
    uint256 public auctionDuration;
    uint256 public startPenalty;  // Start price penalty (WAD)
    uint256 public endPenalty;    // End price penalty (WAD)

    /// @notice Maintenance margin parameters
    uint256 public mmrBase;
    uint256 public mmrMultiplierMax;

    /// @notice Insolvency buffer before backstop
    uint256 public insolvencyBuffer;

    /// @notice Chunk size for partial liquidations
    uint256 public chunkSize;

    /// @notice Auctions by ID
    mapping(bytes32 => Auction) public auctions;

    /// @notice Position ID => Auction ID
    mapping(bytes32 => bytes32) public positionAuction;

    /// @notice Active auction IDs per market
    mapping(bytes32 => bytes32[]) internal _marketAuctions;

    /// @notice All active auction IDs
    bytes32[] internal _allAuctions;

    /// @notice Auction nonce
    uint256 public auctionNonce;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(
        address _collateral,
        address _perpEngine,
        address _indexEngine,
        address _vault,
        address _insuranceFund
    ) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
        perpEngine = IPerpEngine(_perpEngine);
        indexEngine = IIndexEngine(_indexEngine);
        vault = IVault(_vault);
        insuranceFund = IInsuranceFund(_insuranceFund);

        // Default params
        auctionDuration = 600; // 10 minutes
        startPenalty = 2e16;   // 2%
        endPenalty = 10e16;    // 10%
        mmrBase = 5e16;        // 5%
        mmrMultiplierMax = 2e18; // 2x
        insolvencyBuffer = 1e16; // 1%
        chunkSize = 25e16;     // 25%
    }

    // ============================================
    // VIEWS - ILiquidationEngine
    // ============================================

    /// @inheritdoc ILiquidationEngine
    function checkLiquidatable(bytes32 positionId)
        external
        view
        override
        returns (bool liquidatable, PositionEquity memory equity)
    {
        equity = perpEngine.getPositionEquity(positionId);
        liquidatable = equity.isLiquidatable;
        return (liquidatable, equity);
    }

    /// @inheritdoc ILiquidationEngine
    function getAuction(bytes32 auctionId) external view override returns (Auction memory) {
        return auctions[auctionId];
    }

    /// @inheritdoc ILiquidationEngine
    function getCurrentAuctionPrice(bytes32 auctionId) public view override returns (uint256) {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) return 0;

        uint256 elapsed = block.timestamp - auction.startTime;
        if (elapsed >= auction.duration) {
            return auction.endPrice;
        }

        // Linear decay from startPrice to endPrice
        uint256 priceRange = auction.startPrice > auction.endPrice
            ? auction.startPrice - auction.endPrice
            : auction.endPrice - auction.startPrice;

        uint256 decay = (priceRange * elapsed) / auction.duration;

        if (auction.startPrice > auction.endPrice) {
            return auction.startPrice - decay;
        } else {
            return auction.startPrice + decay;
        }
    }

    /// @inheritdoc ILiquidationEngine
    function getAuctionProgress(bytes32 auctionId)
        external
        view
        override
        returns (uint256 elapsed, uint256 remaining, uint256 percentComplete)
    {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) return (0, 0, 0);

        elapsed = block.timestamp - auction.startTime;
        remaining = elapsed >= auction.duration ? 0 : auction.duration - elapsed;
        percentComplete = elapsed >= auction.duration ? WAD : (elapsed * WAD) / auction.duration;

        return (elapsed, remaining, percentComplete);
    }

    /// @inheritdoc ILiquidationEngine
    function getActiveAuctions(bytes32 marketId) external view override returns (bytes32[] memory) {
        return _marketAuctions[marketId];
    }

    /// @inheritdoc ILiquidationEngine
    function getAllActiveAuctions() external view override returns (bytes32[] memory) {
        return _allAuctions;
    }

    /// @inheritdoc ILiquidationEngine
    function hasActiveAuction(bytes32 positionId) external view override returns (bool) {
        bytes32 auctionId = positionAuction[positionId];
        return auctionId != bytes32(0) && auctions[auctionId].isActive;
    }

    /// @inheritdoc ILiquidationEngine
    function calculateKeeperProfit(bytes32 auctionId, int256 fillSize)
        external
        view
        override
        returns (uint256 profit, uint256 fillPrice)
    {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) return (0, 0);

        fillPrice = getCurrentAuctionPrice(auctionId);

        // Get current mark price
        uint256 markPrice = indexEngine.getMarkPrice(auction.marketId);

        // Profit = |fillPrice - markPrice| * fillSize
        // For longs being liquidated: keeper buys at auction price, can sell at mark
        // For shorts being liquidated: keeper sells at auction price, can buy at mark
        if (auction.originalSize > 0) {
            // Long position - keeper takes over long at discount
            if (fillPrice < markPrice) {
                profit = (markPrice - fillPrice) * MathLib.abs(fillSize) / WAD;
            }
        } else {
            // Short position - keeper takes over short at premium
            if (fillPrice > markPrice) {
                profit = (fillPrice - markPrice) * MathLib.abs(fillSize) / WAD;
            }
        }

        return (profit, fillPrice);
    }

    // ============================================
    // LIQUIDATION ACTIONS - ILiquidationEngine
    // ============================================

    /// @inheritdoc ILiquidationEngine
    function startLiquidation(bytes32 positionId)
        external
        override
        nonReentrant
        returns (bytes32 auctionId)
    {
        // Check if already has active auction
        if (positionAuction[positionId] != bytes32(0)) {
            Auction storage existing = auctions[positionAuction[positionId]];
            if (existing.isActive) revert AuctionNotFound(); // Reuse error
        }

        // Check if liquidatable
        PositionEquity memory equity = perpEngine.getPositionEquity(positionId);
        if (!equity.isLiquidatable) revert PositionNotLiquidatable();

        // Check for immediate backstop (insolvent)
        if (equity.isInsolvent) {
            _backstop(positionId);
            return bytes32(0);
        }

        // Get position details
        Position memory pos = perpEngine.getPosition(positionId);
        uint256 markPrice = indexEngine.getMarkPrice(pos.marketId);

        // Calculate auction prices with penalties
        uint256 startPrice;
        uint256 endPrice;

        if (pos.size > 0) {
            // Long position - auction starts below mark, ends lower
            startPrice = markPrice.mulWad(WAD - startPenalty);
            endPrice = markPrice.mulWad(WAD - endPenalty);
        } else {
            // Short position - auction starts above mark, ends higher
            startPrice = markPrice.mulWad(WAD + startPenalty);
            endPrice = markPrice.mulWad(WAD + endPenalty);
        }

        // Create auction
        auctionId = keccak256(abi.encodePacked(positionId, auctionNonce++));

        auctions[auctionId] = Auction({
            auctionId: auctionId,
            positionId: positionId,
            trader: pos.trader,
            marketId: pos.marketId,
            originalSize: pos.size,
            remainingSize: pos.size,
            startPrice: startPrice,
            endPrice: endPrice,
            startTime: block.timestamp,
            duration: auctionDuration,
            isActive: true
        });

        positionAuction[positionId] = auctionId;
        _marketAuctions[pos.marketId].push(auctionId);
        _allAuctions.push(auctionId);

        emit LiquidationStarted(auctionId, positionId, pos.trader, pos.size, startPrice, endPrice);

        return auctionId;
    }

    /// @inheritdoc ILiquidationEngine
    function fillAuction(bytes32 auctionId, int256 fillSize) external override nonReentrant {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) revert AuctionNotActive();

        // Check auction hasn't expired
        if (block.timestamp > auction.startTime + auction.duration) {
            revert AuctionExpired();
        }

        // Validate fill size direction matches position
        if (MathLib.sign(fillSize) != MathLib.sign(auction.remainingSize)) {
            revert InvalidFillSize();
        }

        // Check fill size doesn't exceed remaining
        if (MathLib.abs(fillSize) > MathLib.abs(auction.remainingSize)) {
            fillSize = auction.remainingSize;
        }

        uint256 fillPrice = getCurrentAuctionPrice(auctionId);

        // Execute liquidation through PerpEngine
        (int256 remainingSize, int256 pnl) = perpEngine.liquidatePosition(
            auction.positionId,
            msg.sender,
            fillSize,
            fillPrice
        );

        auction.remainingSize = remainingSize;

        // Calculate keeper profit
        uint256 notional = MathLib.abs(fillSize).mulWad(fillPrice);
        uint256 keeperProfit = notional.mulWad(startPenalty); // Simplified profit calc

        emit AuctionFilled(auctionId, msg.sender, fillSize, fillPrice, keeperProfit);

        // Check if auction is complete
        if (remainingSize == 0) {
            _completeAuction(auctionId);
        }
    }

    /// @inheritdoc ILiquidationEngine
    function backstopLiquidation(bytes32 positionId) external override nonReentrant {
        PositionEquity memory equity = perpEngine.getPositionEquity(positionId);
        if (!equity.isInsolvent) revert PositionNotLiquidatable();

        _backstop(positionId);
    }

    /// @inheritdoc ILiquidationEngine
    function cancelAuction(bytes32 auctionId) external override {
        Auction storage auction = auctions[auctionId];
        if (!auction.isActive) revert AuctionNotActive();

        // Only cancel if expired
        if (block.timestamp <= auction.startTime + auction.duration) {
            revert AuctionNotFound(); // Reuse error - not expired yet
        }

        // If expired with remaining size, trigger backstop
        if (auction.remainingSize != 0) {
            _backstop(auction.positionId);
        }

        _completeAuction(auctionId);
        emit AuctionCancelled(auctionId, "Expired");
    }

    // ============================================
    // CONFIG - ILiquidationEngine
    // ============================================

    /// @inheritdoc ILiquidationEngine
    function setAuctionParams(
        uint256 duration,
        uint256 _startPenalty,
        uint256 _endPenalty
    ) external override onlyOwner {
        auctionDuration = duration;
        startPenalty = _startPenalty;
        endPenalty = _endPenalty;
    }

    /// @inheritdoc ILiquidationEngine
    function setMMRParams(uint256 _mmrBase, uint256 _mmrMultiplierMax) external override onlyOwner {
        mmrBase = _mmrBase;
        mmrMultiplierMax = _mmrMultiplierMax;
    }

    /// @inheritdoc ILiquidationEngine
    function setInsolvencyBuffer(uint256 buffer) external override onlyOwner {
        insolvencyBuffer = buffer;
    }

    /// @inheritdoc ILiquidationEngine
    function setChunkSize(uint256 _chunkSize) external override onlyOwner {
        chunkSize = _chunkSize;
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Set contract addresses
    function setContracts(
        address _perpEngine,
        address _indexEngine,
        address _vault,
        address _insuranceFund
    ) external onlyOwner {
        perpEngine = IPerpEngine(_perpEngine);
        indexEngine = IIndexEngine(_indexEngine);
        vault = IVault(_vault);
        insuranceFund = IInsuranceFund(_insuranceFund);
    }

    // ============================================
    // INTERNAL
    // ============================================

    /// @dev Complete an auction and clean up
    function _completeAuction(bytes32 auctionId) internal {
        Auction storage auction = auctions[auctionId];
        auction.isActive = false;

        // Remove from tracking arrays
        delete positionAuction[auction.positionId];

        // Note: Not removing from arrays to avoid iteration issues
        // Could implement with swap-and-pop pattern if needed

        emit AuctionCompleted(auctionId, auction.originalSize - auction.remainingSize);
    }

    /// @dev Handle backstop liquidation for insolvent position
    function _backstop(bytes32 positionId) internal {
        Position memory pos = perpEngine.getPosition(positionId);
        PositionEquity memory equity = perpEngine.getPositionEquity(positionId);

        // Calculate shortfall (scale from WAD to USDC decimals)
        uint256 shortfall = equity.totalEquity < 0 ? uint256(-equity.totalEquity) / 1e12 : 0;

        // Try to cover from insurance fund
        uint256 covered = 0;
        if (shortfall > 0 && address(insuranceFund) != address(0)) {
            covered = insuranceFund.coverShortfall(positionId, shortfall);
            if (covered > 0) {
                // Transfer received USDC to Vault
                collateral.safeTransfer(address(vault), covered);
                vault.coverShortfall(covered);
                emit InsuranceUsed(positionId, covered);
            }
        }

        // Socialize any remaining shortfall to vault
        uint256 remaining = shortfall - covered;
        if (remaining > 0) {
            vault.socializeLoss(remaining);
            emit LossSocialized(positionId, remaining);
        }

        // Close the position at current mark
        uint256 markPrice = indexEngine.getMarkPrice(pos.marketId);
        perpEngine.liquidatePosition(positionId, address(this), pos.size, markPrice);

        emit BackstopTriggered(positionId, shortfall);
    }
}
