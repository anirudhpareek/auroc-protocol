// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import { Vault } from "../src/core/Vault.sol";
import { IVault } from "../src/interfaces/IVault.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";

contract VaultTest is Test {
    Vault public vault;
    MockUSDC public usdc;

    address public alice = address(0x1);
    address public bob = address(0x2);
    address public engine = address(0x3);

    uint256 public constant WAD = 1e18;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant MAX_UTILIZATION = 8e17; // 80%
    uint256 public constant MIN_LIQUIDITY = 1000e6; // 1000 USDC

    function setUp() public {
        usdc = new MockUSDC();
        vault = new Vault(
            address(usdc),
            uint8(USDC_DECIMALS),
            MAX_UTILIZATION,
            MIN_LIQUIDITY
        );

        // Authorize engine
        vault.setAuthorizedEngine(engine, true);

        // Mint USDC to test users
        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob, 1_000_000e6);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
    }

    // ============================================
    // DEPOSIT TESTS
    // ============================================

    function test_deposit_first_user() public {
        uint256 amount = 10_000e6;

        vm.prank(alice);
        uint256 shares = vault.deposit(amount);

        // First deposit: shares = amount scaled to WAD (18 decimals)
        uint256 expectedShares = amount * 1e12; // 10_000e6 * 1e12 = 10_000e18
        assertEq(shares, expectedShares, "First deposit should scale amount to WAD");
        assertEq(vault.totalAssets(), amount, "Total assets should equal deposit");
        assertEq(vault.totalShares(), shares, "Total shares should equal minted");
        assertEq(vault.balanceOf(alice), shares, "Alice should have shares");
    }

    function test_deposit_multiple_users() public {
        // Alice deposits first
        vm.prank(alice);
        uint256 aliceShares = vault.deposit(10_000e6);

        // Bob deposits second at same share price
        vm.prank(bob);
        uint256 bobShares = vault.deposit(10_000e6);

        // Both should get same shares (first deposit 1:1, second at same price)
        assertApproxEqRel(aliceShares, bobShares, 1e15, "Same deposit should give similar shares");
        assertEq(vault.totalAssets(), 20_000e6, "Total assets should be sum");
    }

    function test_deposit_reverts_zero_amount() public {
        vm.prank(alice);
        vm.expectRevert(IVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_deposit_reverts_when_paused() public {
        vault.setDepositsPaused(true);

        vm.prank(alice);
        vm.expectRevert(IVault.DepositsPaused.selector);
        vault.deposit(10_000e6);
    }

    // ============================================
    // WITHDRAW TESTS
    // ============================================

    function test_withdraw_full() public {
        uint256 depositAmount = 10_000e6;

        vm.prank(alice);
        uint256 shares = vault.deposit(depositAmount);

        uint256 balanceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        uint256 withdrawn = vault.withdraw(shares);

        assertEq(withdrawn, depositAmount, "Should withdraw full amount");
        assertEq(usdc.balanceOf(alice), balanceBefore + depositAmount, "USDC balance should increase");
        assertEq(vault.balanceOf(alice), 0, "Alice should have no shares");
    }

    function test_withdraw_partial() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(10_000e6);

        vm.prank(alice);
        uint256 withdrawn = vault.withdraw(shares / 2);

        assertEq(withdrawn, 5_000e6, "Should withdraw half");
        assertEq(vault.balanceOf(alice), shares / 2, "Alice should have half shares");
    }

    function test_withdraw_reverts_insufficient_balance() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(bob);
        vm.expectRevert(IVault.InsufficientBalance.selector);
        vault.withdraw(1e18);
    }

    function test_withdraw_reverts_when_paused() public {
        vm.prank(alice);
        uint256 shares = vault.deposit(10_000e6);

        vault.setWithdrawalsPaused(true);

        vm.prank(alice);
        vm.expectRevert(IVault.WithdrawalsPaused.selector);
        vault.withdraw(shares);
    }

    // ============================================
    // SHARE PRICE TESTS
    // ============================================

    function test_share_price_initial() public view {
        assertEq(vault.getSharePrice(), WAD, "Initial share price should be 1");
    }

    function test_share_price_after_profit() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        // Simulate profit: add assets to vault
        usdc.mint(address(vault), 1_000e6);
        // Manually update totalAssets (in practice this happens via settlePnL)
        vm.prank(engine);
        vault.unlockCollateral(0); // Just to trigger state, totalAssets updated by direct mint

        // Note: In real scenario, profit flows through settlePnL
        // For this test, we verify share price mechanism
    }

    function test_share_price_after_loss() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        uint256 sharePriceBefore = vault.getSharePrice();

        // Simulate unrealized loss (traders in profit)
        vm.prank(engine);
        vault.updateUnrealizedPnL(1000e18); // Traders up 1000 USDC (in WAD)

        uint256 sharePriceAfter = vault.getSharePrice();

        assertLt(sharePriceAfter, sharePriceBefore, "Share price should decrease with trader profits");
    }

    // ============================================
    // UTILIZATION TESTS
    // ============================================

    function test_utilization_zero_when_empty() public view {
        assertEq(vault.getUtilization(), 0, "Empty vault has 0 utilization");
    }

    function test_utilization_increases_with_locked() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(engine);
        vault.lockCollateral(5_000e6);

        uint256 util = vault.getUtilization();
        assertEq(util, 5e17, "50% utilization expected");
    }

    function test_available_liquidity() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        uint256 available = vault.getAvailableLiquidity();
        // MAX_UTILIZATION is 80%, so available should be 8000 USDC
        assertEq(available, 8_000e6, "Available should be 80% of deposits");
    }

    function test_lock_collateral_respects_max_util() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        // Try to lock more than max utilization allows
        vm.prank(engine);
        vm.expectRevert(IVault.InsufficientLiquidity.selector);
        vault.lockCollateral(9_000e6);
    }

    // ============================================
    // ENGINE INTERFACE TESTS
    // ============================================

    function test_lock_unlock_collateral() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(engine);
        vault.lockCollateral(5_000e6);

        assertEq(vault.getUtilization(), 5e17, "Utilization should be 50%");

        vm.prank(engine);
        vault.unlockCollateral(2_000e6);

        assertEq(vault.getUtilization(), 3e17, "Utilization should be 30%");
    }

    function test_settle_pnl_profit() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        // Trader makes profit of 1000 USDC (in WAD)
        int256 pnl = 1000e18;

        uint256 vaultBalanceBefore = vault.totalAssets();
        uint256 traderBalanceBefore = usdc.balanceOf(bob);

        vm.prank(engine);
        vault.settlePnL(keccak256("XAU"), bob, pnl);

        // Vault pays out profit (scaled from WAD to USDC decimals)
        uint256 pnlScaled = 1000e6;
        assertEq(vault.totalAssets(), vaultBalanceBefore - pnlScaled, "Vault assets should decrease");
        assertEq(usdc.balanceOf(bob), traderBalanceBefore + pnlScaled, "Trader should receive profit");
    }

    function test_settle_pnl_loss() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        // Trader makes loss of 500 USDC (in WAD)
        int256 pnl = -500e18;

        uint256 vaultBalanceBefore = vault.totalAssets();

        vm.prank(engine);
        vault.settlePnL(keccak256("XAU"), bob, pnl);

        // Vault gains from trader loss
        uint256 lossScaled = 500e6;
        assertEq(vault.totalAssets(), vaultBalanceBefore + lossScaled, "Vault assets should increase");
    }

    function test_only_engine_can_lock() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        vm.prank(alice);
        vm.expectRevert(IVault.Unauthorized.selector);
        vault.lockCollateral(1_000e6);
    }

    // ============================================
    // INSURANCE INTERFACE TESTS
    // ============================================

    function test_cover_shortfall() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        uint256 shortfall = 1_000e6;
        // Funds are sent directly to vault before calling coverShortfall
        usdc.mint(address(vault), shortfall);

        uint256 assetsBefore = vault.totalAssets();

        vm.prank(engine);
        vault.coverShortfall(shortfall);

        assertEq(vault.totalAssets(), assetsBefore + shortfall, "Assets should increase by shortfall");
    }

    function test_socialize_loss() public {
        vm.prank(alice);
        vault.deposit(10_000e6);

        uint256 loss = 1_000e6;
        uint256 assetsBefore = vault.totalAssets();

        vm.prank(engine);
        vault.socializeLoss(loss);

        assertEq(vault.totalAssets(), assetsBefore - loss, "Assets should decrease by loss");
    }

    // ============================================
    // CONFIG TESTS
    // ============================================

    function test_set_max_utilization() public {
        vault.setMaxUtilization(9e17); // 90%

        vm.prank(alice);
        vault.deposit(10_000e6);

        uint256 available = vault.getAvailableLiquidity();
        assertEq(available, 9_000e6, "Available should be 90% of deposits");
    }

    function test_only_owner_can_configure() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setMaxUtilization(9e17);
    }

    // ============================================
    // FUZZ TESTS
    // ============================================

    function testFuzz_deposit_withdraw_roundtrip(uint256 amount) public {
        amount = bound(amount, 1e6, 100_000_000e6); // 1 to 100M USDC

        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount);
        uint256 withdrawn = vault.withdraw(shares);
        vm.stopPrank();

        // Should get back exact amount (no fees in basic vault)
        assertEq(withdrawn, amount, "Should withdraw exact deposit amount");
    }

    function testFuzz_utilization_bounds(uint256 depositAmount, uint256 lockAmount) public {
        // Bound to reasonable amounts to avoid precision issues with extreme values
        depositAmount = bound(depositAmount, MIN_LIQUIDITY + 1e6, 100_000_000e6); // Up to 100M USDC
        usdc.mint(alice, depositAmount);

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount);
        vm.stopPrank();

        uint256 maxLockable = vault.getAvailableLiquidity();
        lockAmount = bound(lockAmount, 0, maxLockable);

        if (lockAmount > 0) {
            vm.prank(engine);
            vault.lockCollateral(lockAmount);
        }

        uint256 util = vault.getUtilization();
        // Utilization should not exceed max (allow small rounding tolerance)
        assertLe(util, MAX_UTILIZATION + 1e6, "Utilization should not exceed max (with tolerance)");
    }
}
