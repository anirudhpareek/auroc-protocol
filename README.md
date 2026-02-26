# Auroc Protocol

A vault-counterparty perpetual DEX for **Real World Assets** (gold, equities, indices) that runs 24/7 on Arbitrum Sepolia. Trade traditional markets around the clock with synthetic pricing during off-hours and confidence-aware risk controls.

## Overview

This protocol enables 24/7 trading of RWA underlyings (like XAU/USD, SPX/USD) using:
- **Synthetic pricing** when traditional markets are closed
- **Confidence-aware risk controls** that tighten spreads and leverage during low-confidence periods
- **Safe reopen transitions** that gradually converge synthetic to primary prices
- **Dutch auction liquidations** with keeper bot automation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         EXTERNAL                                │
│  Pyth Oracle ──► OracleRouter ──► IndexEngine ──► PerpEngine   │
│                       │               │              │          │
│                       ▼               ▼              ▼          │
│                  Confidence      Regime FSM     Vault/LP       │
│                       │               │              │          │
│                       └───────┬───────┘              │          │
│                               ▼                      │          │
│                        RiskController ◄──────────────┘          │
│                               │                                 │
│                    ┌──────────┼──────────┐                     │
│                    ▼          ▼          ▼                     │
│              FundingEngine  LiqEngine  TransEngine             │
│                               │                                 │
│                               ▼                                 │
│                        InsuranceFund                           │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
rwa-perp-dex/
├── contracts/          # Foundry smart contracts
│   ├── src/
│   │   ├── core/       # Vault, PerpEngine, InsuranceFund
│   │   ├── engines/    # IndexEngine, RiskController, FundingEngine, LiquidationEngine
│   │   ├── oracle/     # OracleRouter, MockOracleAdapter
│   │   ├── interfaces/ # All contract interfaces
│   │   ├── types/      # Data structures
│   │   └── libraries/  # MathLib utilities
│   ├── test/           # Unit and invariant tests
│   └── script/         # Deployment scripts
├── keeper/             # TypeScript keeper bot
├── ui/                 # Next.js dashboard (WIP)
└── sim/                # Python simulation harness (WIP)
```

## Quick Start

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- Node.js 18+
- pnpm

### Install Dependencies

```bash
# Clone and enter directory
cd rwa-perp-dex

# Install Foundry dependencies
cd contracts
forge install

# Install keeper dependencies
cd ../keeper
pnpm install
```

### Run Tests

```bash
cd contracts

# Run all tests
forge test -vvv

# Run specific test file
forge test --match-path test/OracleRouter.t.sol -vvv

# Run with gas report
forge test --gas-report
```

### Deploy to Arbitrum Sepolia

```bash
cd contracts

# Copy and configure environment
cp ../.env.example ../.env
# Edit .env with your values

# Deploy
forge script script/Deploy.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast

# Verify contracts (optional)
forge verify-contract <ADDRESS> src/core/Vault.sol:Vault --chain arbitrum-sepolia
```

### Run Keeper Bot

```bash
cd keeper

# Configure .env with contract addresses
pnpm dev
```

## Regime System

| Regime | Description | Price Source | Risk Level |
|--------|-------------|--------------|------------|
| OPEN | Market hours | Primary oracle | Normal |
| OFF_HOURS | Market closed | Synthetic aggregation | Elevated |
| TRANSITION | Market reopening | Blended (alpha ramp) | High |
| STRESS | Emergency | Synthetic | Critical (close-only) |

## Key Parameters

### Oracle Configuration
- `MAX_STALENESS`: 120s - max price age before filtering
- `TAU_DECAY`: 60s - weight decay time constant
- `TARGET_SOURCES`: 3 - sources needed for full confidence

### Risk Parameters
- `MAX_LEVERAGE`: 10x base leverage
- `STRESS_THRESHOLD`: 30% confidence triggers STRESS mode
- `SPREAD_BASE`: 0.1% base spread

### Liquidation Parameters
- `MMR_BASE`: 5% maintenance margin
- `AUCTION_DURATION`: 10 minutes
- `PENALTY_START`: 2%, `PENALTY_END`: 10%

## Security Considerations

- All state-changing functions have reentrancy guards
- Ownable2Step for admin functions (two-step ownership transfer)
- Pausable for emergency stops
- Conservative defaults prioritizing solvency over UX

## Markets (MVP)

| Market | Symbol | Description |
|--------|--------|-------------|
| Gold | XAU/USD | Spot gold price |
| S&P 500 | SPX/USD | S&P 500 index |

## License

MIT
