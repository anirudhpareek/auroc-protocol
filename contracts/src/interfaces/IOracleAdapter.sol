// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OraclePrice } from "../types/DataTypes.sol";

/// @title IOracleAdapter
/// @notice Interface that all oracle sources must implement
interface IOracleAdapter {
    /// @notice Get price for a market
    /// @param marketId Market identifier (e.g., keccak256("XAU/USD"))
    /// @return OraclePrice struct with price, timestamp, confidence, liquidity
    function getPrice(bytes32 marketId) external view returns (OraclePrice memory);

    /// @notice Check if this adapter supports a market
    /// @param marketId Market identifier
    /// @return True if market is supported
    function supportsMarket(bytes32 marketId) external view returns (bool);

    /// @notice Get the underlying oracle type
    /// @return Oracle type identifier (e.g., "PYTH", "CHAINLINK", "MOCK")
    function oracleType() external view returns (string memory);
}
