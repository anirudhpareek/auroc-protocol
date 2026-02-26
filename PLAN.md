# 24/7 RWA Perp DEX - Implementation Plan

## Overview

A GMX-style vault-counterparty perpetual DEX for **Real World Assets** (gold, equities, indices) that runs 24/7 on Arbitrum Sepolia with:
- Synthetic pricing when traditional markets are closed
- Confidence-aware risk controls
- Safe reopen transitions
- USDC collateral, onchain settlement

### MVP Assets
| Asset | Ticker | Primary Feed | Market Hours (ET) |
|-------|--------|--------------|-------------------|
| Gold Spot | XAU/USD | Pyth | Sun 6pm - Fri 5pm |
| S&P 500 | SPX/USD | Pyth/Mock | Mon-Fri 9:30am-4pm |

---

## Milestones

### M1: Project Scaffolding
**DoD:** Monorepo initialized, Foundry configured, all directories created
**Files:** Root config, contracts/, keeper/, ui/, sim/
**Commands:**
```bash
mkdir -p rwa-perp-dex && cd rwa-perp-dex
forge init contracts --no-commit
cd contracts && forge install OpenZeppelin/openzeppelin-contracts foundry-rs/forge-std --no-commit
```

### M2: Types & Interfaces
**DoD:** All core structs and interfaces defined, compiles clean
**Files:** types/*.sol, interfaces/*.sol

### M3: Oracle Layer
**DoD:** OracleRouter + MockOracle deployed, confidence scoring works, unit tests pass
**Files:** oracle/*.sol, test/OracleRouter.t.sol

### M4: Index & Regime Engine
**DoD:** IndexEngine FSM works, mark price clamped correctly, regime transitions emit events
**Files:** engines/IndexEngine.sol, test/IndexEngine.t.sol

### M5: Risk Controller
**DoD:** Dynamic leverage/spread/OI caps based on confidence, STRESS triggers
**Files:** engines/RiskController.sol, test/RiskController.t.sol

### M6: Vault & Perp Engine
**DoD:** LP deposit/withdraw, position open/close, impact/spread calculations
**Files:** core/Vault.sol, core/PerpEngine.sol, test/*.t.sol

### M7: Funding Engine
**DoD:** Funding rate calculation with confidence damping, off-hours clamps
**Files:** engines/FundingEngine.sol, test/FundingEngine.t.sol

### M8: Liquidation Engine
**DoD:** Dutch auctions, InsuranceFund backstop, keeper-callable
**Files:** engines/LiquidationEngine.sol, core/InsuranceFund.sol

### M9: Transition Engine
**DoD:** Reopen convergence, anti-exploit rules
**Files:** engines/TransitionEngine.sol

### M10: Integration & Invariant Tests
**DoD:** E2E tests pass, invariant tests with 10k runs
**Files:** test/invariant/*.t.sol, test/integration/*.t.sol

### M11: Keeper Bot
**DoD:** Event listener, auction filler, profitability checks
**Files:** keeper/src/*.ts

### M12: UI Dashboard
**DoD:** Connect wallet, trade, view regime/prices/positions
**Files:** ui/src/**/*.tsx

### M13: Simulation Harness
**DoD:** Gap scenarios, Monte Carlo, metrics output
**Files:** sim/src/*.py

---

## Default Parameters (Conservative)

```
// Oracle
MAX_STALENESS = 120s
TAU_DECAY = 60s
TARGET_SOURCES = 3
S0_DISPERSION = 0.01 (1%)

// Index/Mark
D0_CLAMP = 0.005 (0.5%)
D1_CLAMP = 0.025 (2.5%)
TRANSITION_DURATION = 900s (15min)

// Risk
L0_MAX_LEVERAGE = 10x
C_STRESS = 0.3 (30%)
S0_SPREAD = 0.001 (0.1%)
S1_SPREAD = 0.005 (0.5%)

// Funding
F_MAX = 0.001/hr (0.1%)
GAMMA_IMBALANCE = 0.5
FUNDING_INTERVAL = 1hr

// Liquidation
MMR_BASE = 0.05 (5%)
PENALTY_START = 0.02 (2%)
PENALTY_END = 0.10 (10%)
T_AUCTION = 600s (10min)
INSOLVENCY_BUFFER = 0.01 (1%)

// Vault
MAX_UTILIZATION = 0.8 (80%)
```

---

## External Addresses (Arbitrum Sepolia)

```
PYTH_ADDRESS = 0xff1a0f4744e8582DF1aE09D5611b887B6a12925C
XAU_USD_PRICE_ID = 0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2
// SPX - will use MockOracle (no Pyth feed on testnet)
```

---

## Security Checklist
- [x] ReentrancyGuard on all external state-changing functions
- [x] Ownable2Step for admin functions
- [x] Pausable for STRESS mode
- [x] No external calls before state updates (CEI pattern)
- [x] Overflow protection via Solidity 0.8+
- [x] Access control on privileged functions
