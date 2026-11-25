// Make.fun Pump.fun Bot Sprint Solution
// Algorithmic Trading Bot for Solana Pump.fun Replay Engine (Node 22)
// Strategy: High-conviction Launch Sniper with Rug/Dev-dump Filter & Trailing Take-Profit

import { runBot } from './vendor/agentfun-bot.ts';
import { createStrategy, DEFAULT_PARAMS } from './strategy.ts';

// Optimized parameters:
// - minDevBuy: 500_000_000 lamports (0.5 SOL minimum dev conviction)
// - minTrades: 1, minBuyers: 1 (confirm initial non-creator interest)
// - maxHold: 20 slots
// - skipDevSold & exitOnDevSell: true (instant exit on creator rug)
const strategy = createStrategy({
  ...DEFAULT_PARAMS,
  minTrades: 1,
  minBuyers: 1,
  minDevBuy: 500_000_000,
  maxHold: 20,
  skipDevSold: true,
  exitOnDevSell: true,
});

await runBot({
  onBatch: (state, batch) => strategy.onBatch(state, batch),
});
