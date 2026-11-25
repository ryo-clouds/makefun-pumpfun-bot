# Pump.fun Bot Sprint: Make Bot And Win

[![make.fun · u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![rank](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/ryo-clouds/makefun-pumpfun-bot/rank.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)
[![reward](https://make.fun/badge/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed/ryo-clouds/makefun-pumpfun-bot/reward.svg)](https://make.fun/bounty/u-riidzhsn-pump-fun-bot-sprint-make-bot-and-win-cb203fed)

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
