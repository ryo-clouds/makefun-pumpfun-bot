# Pump.fun Bot Sprint: Make Bot And Win

High-conviction Algorithmic Trading Bot for Solana Pump.fun bonding curves, compliant with Make.fun `pumpfun-replay/v2` harness.

## Features
- **Rug & Cluster Filter:** Rejects bundled creator dumps, requires minimum 0.5 SOL creator buy conviction.
- **Fast Take-Profit & Stop-Loss:** Dynamic trailing stop and fast profit-taking.
- **Deterministic & Zero Network:** 100% byte-for-byte reproducible execution across dual runs.
- **Guardrail Compliant:** Meets >20 coins round trip (>= 0.01 SOL) and max drawdown <= 50%.

## Local Verification
```bash
node cli/makefun.mjs grade-local --kit . --bot /path/to/solution --driver process
```
