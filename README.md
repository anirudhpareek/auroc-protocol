# Auroc Protocol

A vault-counterparty perpetual DEX for **Real World Assets** (gold, equities, indices) that runs 24/7 on Arbitrum Sepolia. Trade traditional markets around the clock with synthetic pricing during off-hours and confidence-aware risk controls.

## What Makes Auroc Different

Auroc combines the best mechanisms from leading perp DEXs:

| Feature | Inspired By | Benefit |
|---------|-------------|---------|
| **Two-Tier Liquidity** | [Ostium](https://ostium-labs.gitbook.io/ostium-docs/shared-liquidity-layer/liquidity-buffer) | LPs don't take first-loss; Buffer absorbs PnL first |
| **Loss Rebates** | [Avantis](https://docs.avantisfi.com/rewards/loss-rebates) | 20% rebate on losses for trades that balance OI skew |
| **Positive Slippage** | [Avantis](https://docs.avantisfi.com/) | Better-than-mark execution for risk-reducing trades |
| **Risk-Based Premia** | [Vest](https://docs.vest.exchange/overview/vest-architecture/zkrisk-engine) | Dynamic pricing based on marginal risk contribution |

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           TRADER FLOW                                  │
│                                                                        │
│   Trader ──► PerpEngineV2 ──► LiquidityBuffer ──► Vault (if needed)   │
│                  │                    │                                │
│          ┌──────┴──────┐              │                                │
│          ▼             ▼              ▼                                │
│    SkewManager   PremiaCalculator   InsuranceFund                     │
│   (Avantis-style)  (Vest-style)     (backstop)                        │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│                          PRICE FLOW                                    │
│                                                                        │
│   Oracle Sources ──► OracleRouter ──► IndexEngine ──► RiskController  │
│                     (aggregation)   (regime FSM)   (dynamic params)    │
└────────────────────────────────────────────────────────────────────────┘
```

## Key Mechanisms

### 1. Two-Tier Liquidity (from Ostium)

```
Traditional:  Trader PnL ──► LP Vault (LPs take all risk)

Auroc:        Trader PnL ──► LiquidityBuffer ──► LP Vault
                            (first-loss layer)  (only if buffer depleted)
```

- **LiquidityBuffer**: Absorbs trader profits first, accumulates losses
- **Vault**: Only tapped when buffer is fully depleted
- **Result**: LPs get more stable returns, reduced adversarial relationship

### 2. OI Skew Incentives (from Avantis)

**Loss Rebates**: If you open a position that balances the OI skew, you get up to 20% rebate on any losses. This eligibility is locked at position open and never expires.

```solidity
// Example: Market is 70% long, 30% short
// You open a SHORT → You qualify for loss rebates
// If you lose $100 → You get $20 back
```

**Positive Slippage**: Trades that reduce OI skew get better-than-mark execution instead of worse.

```solidity
// Normal: Buy at mark + spread
// Balancing trade: Buy at mark - slippage_reward
```

### 3. Risk-Based Premia (from Vest)

Instead of flat impact fees, each trade is priced based on its marginal risk contribution:

```
Premia = (RiskAfter - RiskBefore) × BasePremiaRate

Risk Score = f(concentration, volatility, exposure, imbalance)
```

- **Risk-increasing trades** → Pay higher premia
- **Risk-reducing trades** → Get rewarded with negative premia (better price)
- **Eliminates need for hard OI caps** - risk is priced in dynamically

## Regime System

| Regime | Description | Price Source | Risk Level |
|--------|-------------|--------------|------------|
| OPEN | Market hours | Primary oracle | Normal |
| OFF_HOURS | Market closed | Synthetic aggregation | Elevated |
| TRANSITION | Market reopening | Blended (alpha ramp) | High |
| STRESS | Emergency | Synthetic | Critical (close-only) |

## Project Structure

```
auroc-protocol/
├── contracts/
│   ├── src/
│   │   ├── core/
│   │   │   ├── PerpEngineV2.sol    # Enhanced trading engine
│   │   │   ├── LiquidityBuffer.sol # First-loss layer (Ostium)
│   │   │   ├── Vault.sol           # LP vault
│   │   │   └── InsuranceFund.sol   # Backstop
│   │   ├── engines/
│   │   │   ├── SkewManager.sol     # Rebates & slippage (Avantis)
│   │   │   ├── PremiaCalculator.sol# Risk pricing (Vest)
│   │   │   ├── IndexEngine.sol     # Regime FSM
│   │   │   ├── RiskController.sol  # Dynamic params
│   │   │   ├── FundingEngine.sol   # Funding rates
│   │   │   └── LiquidationEngine.sol
│   │   ├── oracle/
│   │   │   ├── OracleRouter.sol    # Synthetic aggregation
│   │   │   └── MockOracleAdapter.sol
│   │   └── ...
│   ├── script/
│   │   ├── Deploy.s.sol            # V1 deployment
│   │   └── DeployV2.s.sol          # V2 with all features
│   └── test/
├── keeper/                         # TypeScript keeper bot
└── ...
```

## Default Parameters

### Skew Incentives (Avantis-style)
- `LOSS_REBATE_RATE`: 20% - rebate on losses for balancing trades
- `POSITIVE_SLIPPAGE_RATE`: 0.3% - max price improvement
- `MIN_SKEW_FOR_INCENTIVE`: 10% - minimum skew to qualify

### Risk Premia (Vest-style)
- `BASE_PREMIA_RATE`: 0.5% - base risk charge
- `CONCENTRATION_MULTIPLIER`: 2x - penalty for concentrated positions
- `VOLATILITY_MULTIPLIER`: 1.5x - adjustment for high volatility
- `CONFIDENCE_MULTIPLIER`: 2x - additional charge in low confidence

### Two-Tier Liquidity (Ostium-style)
- `TARGET_BUFFER_SIZE`: $100,000 - optimal buffer level
- Buffer takes first loss, Vault only used when buffer depleted

## Quick Start

```bash
# Install dependencies
cd contracts
forge install

# Run tests
forge test -vvv

# Deploy V2 to testnet
forge script script/DeployV2.s.sol --rpc-url $ARB_SEPOLIA_RPC --broadcast
```

## Markets (MVP)

| Market | Symbol | Description |
|--------|--------|-------------|
| Gold | XAU/USD | Spot gold price |
| S&P 500 | SPX/USD | S&P 500 index |

## Security Considerations

- ReentrancyGuard on all external state-changing functions
- Ownable2Step for admin functions
- Pausable for emergency stops
- Two-tier liquidity protects LPs from immediate losses
- Risk-based pricing naturally limits dangerous positions

## Acknowledgments

This protocol incorporates mechanisms from:
- [Ostium](https://ostium-labs.gitbook.io/ostium-docs) - Two-tier liquidity architecture
- [Avantis](https://docs.avantisfi.com/) - Loss rebates and positive slippage
- [Vest](https://docs.vest.exchange/) - Risk-based premia pricing

## License

MIT
