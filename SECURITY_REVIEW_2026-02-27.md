# Auroc Protocol Security Review (2026-02-27)

This PR intentionally adds a review document only (no contract edits) so findings can be reviewed in isolation.

## Scope Reviewed

- `contracts/src/core/*`
- `contracts/src/engines/*`
- `contracts/src/oracle/*`
- `contracts/src/libraries/MathLib.sol`
- `contracts/script/*`
- `contracts/test/*`

## Test Status

Executed:

```bash
cd contracts
forge test --offline
```

Result: 134 passed, 0 failed.

Note: passing tests do not imply security completeness; most tests are non-adversarial.

## High-Severity Findings

### 1) CRITICAL: V2 settlement mixes 6-decimal and 18-decimal units

- `PerpEngineV2` computes `netReturn` by combining:
  - `pos.margin` (USDC decimals, 6)
  - `pnl` (WAD, 18)
  - `fee` (WAD, 18)
  - `rebate` (WAD, 18)
- This mixed-unit arithmetic is then passed to `LiquidityBuffer.settlePnL`, which expects collateral-unit amounts.

Primary references:

- `contracts/src/core/PerpEngineV2.sol:619`
- `contracts/src/core/PerpEngineV2.sol:627`
- `contracts/src/core/LiquidityBuffer.sol:141`

Impact:

- Incorrect payouts and accounting drift.
- Possible insolvency or underpayment/overpayment.

---

### 2) CRITICAL: Missing access control on externally callable risk state updaters

Multiple contracts expose public state mutators marked by TODO comments and currently callable by anyone.

Primary references:

- `contracts/src/engines/RiskController.sol:269`
- `contracts/src/engines/RiskController.sol:277`
- `contracts/src/engines/RiskController.sol:285`
- `contracts/src/engines/SkewManager.sol:196`
- `contracts/src/engines/SkewManager.sol:216`
- `contracts/src/engines/SkewManager.sol:245`
- `contracts/src/engines/PremiaCalculator.sol:188`
- `contracts/src/engines/PremiaCalculator.sol:212`
- `contracts/src/engines/PremiaCalculator.sol:242`

Impact:

- Manipulation of OI/utilization/volatility and incentive state.
- Risk checks may be bypassed or made excessively restrictive (DoS).

---

### 3) CRITICAL: Liquidation flow does not perform full economic settlement invariants

`liquidatePosition` updates position size and OI but does not consistently realize/transfer settlement side-effects equivalent to close flows.

Primary references:

- `contracts/src/core/PerpEngine.sol:383`
- `contracts/src/core/PerpEngineV2.sol:418`

Impact:

- Locked-collateral and PnL-accounting divergence under liquidation.
- Potential stuck or inconsistent system state.

---

### 4) HIGH: Position flip/cross-zero handling can misclassify risk-increasing changes

`isIncrease` derives from direction relationship and can be wrong for cross-zero changes that should be split into close + open semantics.

Primary references:

- `contracts/src/core/PerpEngine.sol:258`
- `contracts/src/core/PerpEngine.sol:265`
- `contracts/src/core/PerpEngineV2.sol:292`
- `contracts/src/core/PerpEngineV2.sol:298`

Impact:

- Incorrect validation path (especially leverage/OI) during reversals.

---

### 5) HIGH: V2 fee accounting can increase buffer bookkeeping without token movement

`accumulateFees` increments `bufferBalance`, but `PerpEngineV2` does not transfer fee collateral into `LiquidityBuffer`.

Primary references:

- `contracts/src/core/PerpEngineV2.sol:264`
- `contracts/src/core/LiquidityBuffer.sol:214`

Impact:

- Artificially inflated liquidity accounting.

## Medium-Severity Findings

### 6) MEDIUM: V1 `removeMargin` attempts transfer from PerpEngine balance

Primary references:

- `contracts/src/core/PerpEngine.sol:368`
- `contracts/src/core/PerpEngine.sol:373`

Impact:

- Can revert in production if `PerpEngine` does not hold collateral.

---

### 7) MEDIUM: OracleRouter allows config values that can cause division-by-zero runtime failures

Primary references:

- `contracts/src/oracle/OracleRouter.sol:232`
- `contracts/src/oracle/OracleRouter.sol:88`
- `contracts/src/oracle/OracleRouter.sol:321`
- `contracts/src/oracle/OracleRouter.sol:341`

Impact:

- Pricing path can revert if owner sets invalid zero params.

## Recommended Fix Order

1. Decimal/settlement invariants (V2 and liquidation flows).
2. Access control on all external mutators (allowlist engine callers).
3. Cross-zero position modification logic (close portion then open new side).
4. Fee transfer/accounting consistency.
5. Config validation hardening.

## Reviewer Notes

- This is a manual review snapshot for discussion and validation.
- No claims of formal verification.
- Recommended next step is to pair each finding with adversarial tests before deploying fixes.
