// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { IInsuranceFund } from "../interfaces/IInsuranceFund.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Ownable2Step, Ownable } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title InsuranceFund
/// @notice Backstop fund for covering liquidation shortfalls
contract InsuranceFund is IInsuranceFund, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // STATE
    // ============================================

    /// @notice Collateral token
    IERC20 public immutable collateral;

    /// @notice Total amount covered
    uint256 public totalCovered;

    /// @notice Number of shortfalls covered
    uint256 public shortfallCount;

    /// @notice Authorized callers (LiquidationEngine)
    mapping(address => bool) public authorized;

    // ============================================
    // CONSTRUCTOR
    // ============================================

    constructor(address _collateral) Ownable(msg.sender) {
        collateral = IERC20(_collateral);
    }

    // ============================================
    // MODIFIERS
    // ============================================

    modifier onlyAuthorized() {
        if (!authorized[msg.sender] && msg.sender != owner()) {
            revert Unauthorized();
        }
        _;
    }

    // ============================================
    // VIEWS - IInsuranceFund
    // ============================================

    /// @inheritdoc IInsuranceFund
    function getBalance() public view override returns (uint256) {
        return collateral.balanceOf(address(this));
    }

    /// @inheritdoc IInsuranceFund
    function getTotalCovered() external view override returns (uint256) {
        return totalCovered;
    }

    /// @inheritdoc IInsuranceFund
    function getShortfallCount() external view override returns (uint256) {
        return shortfallCount;
    }

    // ============================================
    // ACTIONS - IInsuranceFund
    // ============================================

    /// @inheritdoc IInsuranceFund
    function coverShortfall(
        bytes32 positionId,
        uint256 amount
    ) external override onlyAuthorized nonReentrant returns (uint256 covered) {
        uint256 balance = getBalance();

        if (balance == 0) {
            emit FundsExhausted(positionId, amount);
            return 0;
        }

        // Cover up to available balance
        covered = amount > balance ? balance : amount;

        // Transfer to caller (LiquidationEngine/Vault)
        collateral.safeTransfer(msg.sender, covered);

        totalCovered += covered;
        shortfallCount++;

        emit ShortfallCovered(positionId, covered);

        if (covered < amount) {
            emit FundsExhausted(positionId, amount - covered);
        }

        return covered;
    }

    /// @inheritdoc IInsuranceFund
    function deposit(uint256 amount) external override nonReentrant {
        if (amount == 0) revert ZeroAmount();

        collateral.safeTransferFrom(msg.sender, address(this), amount);

        emit FundsDeposited(msg.sender, amount);
    }

    /// @inheritdoc IInsuranceFund
    function withdraw(uint256 amount, address to) external override onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (amount > getBalance()) revert InsufficientFunds();

        collateral.safeTransfer(to, amount);

        emit FundsWithdrawn(to, amount);
    }

    // ============================================
    // ADMIN
    // ============================================

    /// @notice Set authorized caller
    /// @param caller Address to authorize
    /// @param isAuthorized Authorization status
    function setAuthorized(address caller, bool isAuthorized) external onlyOwner {
        authorized[caller] = isAuthorized;
    }
}
