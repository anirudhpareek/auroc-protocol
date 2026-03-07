// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { OptionLeg, OptionPosition, Greeks, CollateralRequirement } from "../types/OptionsTypes.sol";

/// @title IOptionsPool
/// @notice Interface for Auroc perpetual options pool
interface IOptionsPool {

    // ============================================
    // EVENTS
    // ============================================

    event OptionMinted(
        bytes32 indexed positionId,
        address indexed owner,
        bytes32 indexed marketId,
        uint256 legCount,
        uint256 collateralLocked,
        uint256 premiumPaid
    );

    event OptionBurned(
        bytes32 indexed positionId,
        address indexed owner,
        int256  payout        // signed: positive = profit for caller
    );

    event VolatilityUpdated(bytes32 indexed marketId, uint256 iv);

    // ============================================
    // ERRORS
    // ============================================

    error OptionsSuspended(bytes32 marketId);
    error InvalidLegCount();
    error InsufficientCollateral();
    error PositionNotFound();
    error NotPositionOwner();
    error StrikeMustBePositive();
    error NotionalTooSmall();
    error CostExceedsMax();
    error PayoutBelowMin();
    error MarketNotRegistered();

    // ============================================
    // TRADING
    // ============================================

    /// @notice Mint a new option position (1–4 legs)
    /// @param legs     Array of option legs (1–4)
    /// @param maxCost  Max USDC cost caller is willing to pay (6 decimals)
    /// @return positionId Unique position ID
    function mintOption(
        OptionLeg[] calldata legs,
        uint256 maxCost
    ) external returns (bytes32 positionId);

    /// @notice Burn (close) an existing option position
    /// @param positionId Position to close
    /// @param minPayout  Minimum USDC payout expected (reverts if below)
    /// @return payout   USDC returned to caller (6 decimals)
    function burnOption(
        bytes32 positionId,
        uint256 minPayout
    ) external returns (uint256 payout);

    // ============================================
    // VIEWS
    // ============================================

    function getOptionPosition(bytes32 positionId) external view returns (OptionPosition memory);

    function getTraderOptions(address trader) external view returns (bytes32[] memory);

    /// @notice Compute Greeks for a single leg
    function getGreeks(
        bytes32 marketId,
        uint256 strike,
        bool    isCall
    ) external view returns (Greeks memory);

    /// @notice Get total collateral required to open a set of legs
    function getRequiredCollateral(
        OptionLeg[] calldata legs
    ) external view returns (CollateralRequirement memory);

    /// @notice Get current option value for an open position (USDC 6 dec)
    function getCurrentValue(bytes32 positionId) external view returns (uint256);
}
