// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { AggregatedPrice, OracleSource, OraclePrice } from "../types/DataTypes.sol";

/// @title IOracleRouter
/// @notice Interface for synthetic price aggregation with confidence scoring
interface IOracleRouter {
    // ============================================
    // EVENTS
    // ============================================

    event SourceAdded(bytes32 indexed marketId, address indexed source, uint256 weight, bool isPrimary);
    event SourceRemoved(bytes32 indexed marketId, address indexed source);
    event SourceUpdated(bytes32 indexed marketId, address indexed source, uint256 weight, bool isActive);
    event PriceAggregated(
        bytes32 indexed marketId,
        uint256 price,
        uint256 confidence,
        uint256 dispersion,
        uint256 sourceCount
    );
    event ConfigUpdated(uint256 maxStaleness, uint256 tauDecay, uint256 targetSources);

    // ============================================
    // ERRORS
    // ============================================

    error NoValidSources();
    error SourceAlreadyExists();
    error SourceNotFound();
    error InvalidWeight();
    error InvalidAddress();
    error StalePrice();

    // ============================================
    // VIEWS
    // ============================================

    /// @notice Get aggregated price for a market
    /// @param marketId Market identifier
    /// @return Aggregated price with confidence metrics
    function getAggregatedPrice(bytes32 marketId) external view returns (AggregatedPrice memory);

    /// @notice Get primary source price (for OPEN regime)
    /// @param marketId Market identifier
    /// @return price Primary source price
    /// @return timestamp Price timestamp
    function getPrimaryPrice(bytes32 marketId) external view returns (uint256 price, uint256 timestamp);

    /// @notice Get all sources for a market
    /// @param marketId Market identifier
    /// @return Array of oracle sources
    function getSources(bytes32 marketId) external view returns (OracleSource[] memory);

    /// @notice Get raw price from a specific source
    /// @param source Source adapter address
    /// @param marketId Market identifier
    /// @return OraclePrice struct
    function getRawPrice(address source, bytes32 marketId) external view returns (OraclePrice memory);

    /// @notice Get oracle configuration
    /// @return maxStaleness Maximum price age in seconds
    /// @return tauDecay Weight decay time constant
    /// @return targetSources Target number of sources for full confidence
    function getConfig()
        external
        view
        returns (uint256 maxStaleness, uint256 tauDecay, uint256 targetSources);

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Add a new oracle source for a market
    /// @param marketId Market identifier
    /// @param source Oracle adapter address
    /// @param weight Relative weight [0, 1e18]
    /// @param isPrimary Whether this is the primary source
    function addSource(bytes32 marketId, address source, uint256 weight, bool isPrimary) external;

    /// @notice Remove an oracle source
    /// @param marketId Market identifier
    /// @param source Oracle adapter address
    function removeSource(bytes32 marketId, address source) external;

    /// @notice Update source configuration
    /// @param marketId Market identifier
    /// @param source Oracle adapter address
    /// @param weight New weight
    /// @param isActive Whether source is active
    function updateSource(bytes32 marketId, address source, uint256 weight, bool isActive) external;

    /// @notice Update global oracle config
    /// @param maxStaleness Maximum price age in seconds
    /// @param tauDecay Weight decay time constant
    /// @param targetSources Target sources for full C_src
    function setConfig(uint256 maxStaleness, uint256 tauDecay, uint256 targetSources) external;
}
