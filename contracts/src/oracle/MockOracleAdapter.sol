// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IOracleAdapter } from "../interfaces/IOracleAdapter.sol";
import { OraclePrice } from "../types/DataTypes.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockOracleAdapter
/// @notice Mock oracle for testing - allows manual price setting
/// @dev Implements IOracleAdapter interface identically to real adapters
contract MockOracleAdapter is IOracleAdapter, Ownable {
    // ============================================
    // STATE
    // ============================================

    struct MockPrice {
        uint256 price;
        uint256 confidence;
        uint256 liquidity;
        uint256 timestamp;
        bool isSet;
    }

    mapping(bytes32 => MockPrice) public prices;
    mapping(bytes32 => bool) public supportedMarkets;

    // ============================================
    // EVENTS
    // ============================================

    event PriceSet(bytes32 indexed marketId, uint256 price, uint256 confidence, uint256 liquidity);
    event MarketAdded(bytes32 indexed marketId);
    event MarketRemoved(bytes32 indexed marketId);

    // ============================================
    // ERRORS
    // ============================================

    error MarketNotSupported();
    error PriceNotSet();
    error InvalidPrice();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // IOracleAdapter IMPLEMENTATION
    // ============================================

    /// @inheritdoc IOracleAdapter
    function getPrice(bytes32 marketId) external view override returns (OraclePrice memory) {
        if (!supportedMarkets[marketId]) revert MarketNotSupported();

        MockPrice storage mp = prices[marketId];
        if (!mp.isSet) revert PriceNotSet();

        return OraclePrice({
            price: mp.price,
            timestamp: mp.timestamp,
            confidence: mp.confidence,
            liquidity: mp.liquidity
        });
    }

    /// @inheritdoc IOracleAdapter
    function supportsMarket(bytes32 marketId) external view override returns (bool) {
        return supportedMarkets[marketId];
    }

    /// @inheritdoc IOracleAdapter
    function oracleType() external pure override returns (string memory) {
        return "MOCK";
    }

    // ============================================
    // ADMIN - PRICE SETTING
    // ============================================

    /// @notice Set price for a market
    /// @param marketId Market identifier
    /// @param price Price in WAD (1e18)
    /// @param confidence Confidence score [0, 1e18]
    /// @param liquidity Liquidity score [0, 1e18]
    function setPrice(
        bytes32 marketId,
        uint256 price,
        uint256 confidence,
        uint256 liquidity
    ) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        if (!supportedMarkets[marketId]) revert MarketNotSupported();

        prices[marketId] = MockPrice({
            price: price,
            confidence: confidence,
            liquidity: liquidity,
            timestamp: block.timestamp,
            isSet: true
        });

        emit PriceSet(marketId, price, confidence, liquidity);
    }

    /// @notice Set price with custom timestamp (for testing staleness)
    /// @param marketId Market identifier
    /// @param price Price in WAD
    /// @param confidence Confidence score
    /// @param liquidity Liquidity score
    /// @param timestamp Custom timestamp
    function setPriceWithTimestamp(
        bytes32 marketId,
        uint256 price,
        uint256 confidence,
        uint256 liquidity,
        uint256 timestamp
    ) external onlyOwner {
        if (price == 0) revert InvalidPrice();
        if (!supportedMarkets[marketId]) revert MarketNotSupported();

        prices[marketId] = MockPrice({
            price: price,
            confidence: confidence,
            liquidity: liquidity,
            timestamp: timestamp,
            isSet: true
        });

        emit PriceSet(marketId, price, confidence, liquidity);
    }

    /// @notice Batch set prices
    /// @param marketIds Array of market identifiers
    /// @param _prices Array of prices
    /// @param confidences Array of confidence scores
    /// @param liquidities Array of liquidity scores
    function setBatchPrices(
        bytes32[] calldata marketIds,
        uint256[] calldata _prices,
        uint256[] calldata confidences,
        uint256[] calldata liquidities
    ) external onlyOwner {
        require(
            marketIds.length == _prices.length &&
            marketIds.length == confidences.length &&
            marketIds.length == liquidities.length,
            "LENGTH_MISMATCH"
        );

        for (uint256 i = 0; i < marketIds.length; i++) {
            if (_prices[i] == 0) revert InvalidPrice();
            if (!supportedMarkets[marketIds[i]]) revert MarketNotSupported();

            prices[marketIds[i]] = MockPrice({
                price: _prices[i],
                confidence: confidences[i],
                liquidity: liquidities[i],
                timestamp: block.timestamp,
                isSet: true
            });

            emit PriceSet(marketIds[i], _prices[i], confidences[i], liquidities[i]);
        }
    }

    // ============================================
    // ADMIN - MARKET MANAGEMENT
    // ============================================

    /// @notice Add a supported market
    /// @param marketId Market identifier
    function addMarket(bytes32 marketId) external onlyOwner {
        supportedMarkets[marketId] = true;
        emit MarketAdded(marketId);
    }

    /// @notice Remove a supported market
    /// @param marketId Market identifier
    function removeMarket(bytes32 marketId) external onlyOwner {
        supportedMarkets[marketId] = false;
        delete prices[marketId];
        emit MarketRemoved(marketId);
    }

    /// @notice Batch add markets
    /// @param marketIds Array of market identifiers
    function addMarkets(bytes32[] calldata marketIds) external onlyOwner {
        for (uint256 i = 0; i < marketIds.length; i++) {
            supportedMarkets[marketIds[i]] = true;
            emit MarketAdded(marketIds[i]);
        }
    }
}
