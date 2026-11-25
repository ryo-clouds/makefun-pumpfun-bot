// Solana Pump.fun High-Conviction Sniper & Rug-Filter Bot
// Optimized Replay Strategy for Make.fun Competition
// Deterministic Execution Architecture (Node 22 / TypeScript)

import { BPS, type BotState, type Batch, type OrderInput, type Pubkey } from './vendor/agentfun-bot.ts';

export interface Params {
  /** Minimum age in slots from coin creation before initial buy consideration */
  minAge: number;
  /** Maximum age in slots allowed for initiating the first position tranche */
  maxAge: number;
  /** Target investment budget allocated per prospective token in lamports */
  stakeLamports: number;
  /** Smallest order execution threshold permitted after network transaction fees */
  minBuyLamports: number;
  /** Maximum number of secondary pyramid tranches permitted per asset */
  maxAdds: number;
  /** Price increment threshold in basis points required before adding size */
  addStepBps: number;
  /** Minimum latency interval in slots required between subsequent entries */
  addDelay: number;
  /** Capital allocation assigned to each supplementary tranche in lamports */
  addLamports: number;
  /** Minimum positive net liquidity flow required during addition evaluation */
  addMinFlowLamports: number;
  /** Lower boundary of real SOL liquidity reserve required for qualification */
  minRealSol: number;
  /** Upper boundary of real SOL liquidity reserve permitted for qualification */
  maxRealSol: number;
  /** Minimum initial allocation acquired by token creator at genesis slot */
  minDevBuy: number;
  /** Maximum initial allocation acquired by token creator at genesis slot */
  maxDevBuy: number;
  /** Minimum cumulative trades required before considering entry */
  minTrades: number;
  /** Minimum unique non-creator purchasers required to validate organic interest */
  minBuyers: number;
  /** Maximum unique non-creator purchasers allowed (filters early wallet bundles) */
  maxBuyers: number;
  /** Upper limit on non-creator sell volume as a fraction of total buy volume */
  maxSellRatioBps: number;
  /** Maximum permitted single-transaction dump relative to real SOL reserves */
  maxBigSellBps: number;
  /** Lower bound of acceptable price run-up relative to initial bonding curve */
  minRunupBps: number;
  /** Upper bound of acceptable price run-up relative to initial bonding curve */
  maxRunupBps: number;
  /** Observation horizon window in slots for trailing order flow metrics */
  flowWindow: number;
  /** Net liquidity inflow threshold over the observation horizon in lamports */
  minFlowLamports: number;
  /** Minimum active organic purchasers observed within the flow horizon window */
  minRecentBuyers: number;
  /** Flag enforcing immediate abandonment if developer wallet liquidates tokens */
  skipDevSold: boolean;
  /** Maximum allowed buy slippage in basis points to avoid front-running losses */
  buySlippageBps: number;
  /** First profit target threshold in basis points above position cost basis */
  tp1Bps: number;
  /** Proportional share in basis points of inventory liquidated at TP1 trigger */
  tp1PartBps: number;
  /** Trailing stop loss benchmark applied after TP1 execution in basis points */
  slAfterTp1Bps: number;
  /** Primary take-profit liquidation threshold in basis points over cost basis */
  tpBps: number;
  /** Maximum tolerable draw-down loss threshold in basis points below cost basis */
  slBps: number;
  /** Activation elevation in basis points required to engage dynamic trailing stop */
  trailArmBps: number;
  /** Trailing distance retreat in basis points from cycle peak triggering exit */
  trailBps: number;
  /** Maximum holding duration in slots before mandatory position liquidation */
  maxHold: number;
  /** Flag dictating instantaneous liquidation if token creator sells while held */
  exitOnDevSell: boolean;
  /** Slot inactivity duration triggering position close due to trading stall */
  staleSlots: number;
  /** Negative liquidity outflow threshold in lamports triggering emergency exit */
  exitFlowLamports: number;
  /** Global fill target pacing quota used for order piece splitting */
  fillTarget: number;
  /** Benchmark duration in seconds for prorating global fill target pacing */
  windowSeconds: number;
  /** Baseline count of split order slices generated under standard conditions */
  baseSplit: number;
  /** Ceiling on dynamic order slices generated during lagging fill pacing */
  maxSplit: number;
  /** Minimum lamports value required for an individual split order tranche */
  minPieceLamports: number;
}

export const DEFAULT_PARAMS: Params = {
  minAge: 0,
  maxAge: 3,
  stakeLamports: 100_000_000,
  minBuyLamports: 5_000_000,
  maxAdds: 0,
  addStepBps: 0,
  addDelay: 2,
  addLamports: 100_000_000,
  addMinFlowLamports: 0,
  minRealSol: 300_000_000,
  maxRealSol: 30_000_000_000,
  minDevBuy: 0,
  maxDevBuy: 2_500_000_000,
  minTrades: 0,
  minBuyers: 0,
  maxBuyers: 3,
  maxSellRatioBps: 10_000,
  maxBigSellBps: 10_000,
  minRunupBps: 0,
  maxRunupBps: 1_000_000,
  flowWindow: 10,
  minFlowLamports: -1_000_000_000_000,
  minRecentBuyers: 0,
  skipDevSold: true,
  buySlippageBps: 10_000,
  tp1Bps: 1_000_000,
  tp1PartBps: 5_000,
  slAfterTp1Bps: 0,
  tpBps: 1_500,
  slBps: 1_200,
  trailArmBps: 1_000_000,
  trailBps: 1_000,
  maxHold: 10,
  exitOnDevSell: true,
  staleSlots: 1_000_000,
  exitFlowLamports: 1_000_000_000_000,
  fillTarget: 300,
  windowSeconds: 21_600,
  baseSplit: 1,
  maxSplit: 6,
  minPieceLamports: 2_000_000,
};

interface HistoricalTradeTick {
  tradeSlot: number;
  isBuyOrder: boolean;
  solAmountLamports: bigint;
  walletPubkey: Pubkey;
}

interface TrackedCoinState {
  coinMint: Pubkey;
  creationSlot: number;
  creatorWallet: Pubkey;
  initialVirtualQuote: bigint;
  initialVirtualToken: bigint;
  creatorTotalBuyLamports: bigint;
  totalTradeCount: number;
  distinctBuyerWallets: Set<Pubkey>;
  aggregateBoughtLamports: bigint;
  externalSoldLamports: bigint;
  peakSingleSellRatioBps: bigint;
  creatorHasSold: boolean;
  mostRecentTradeSlot: number;
  recentTradeWindow: HistoricalTradeTick[];
  buyOrdersDispatchedCount: number;
  totalLamportsDispatched: bigint;
  lastDecisionVirtualQuote: bigint;
  lastDecisionVirtualToken: bigint;
  lastBuyDecisionSlot: number;
  isTerminated: boolean;
  bondingCurveCompleted: boolean;
}

interface OpenPositionMetadata {
  entrySlot: number;
  cumulativeTxFeesPaidLamports: bigint;
  highestObservedValueLamports: bigint;
  devSoldPriorToEntry: boolean;
  firstTakeProfitExecuted: boolean;
}

export interface Strategy {
  onBatch(state: BotState, batch: Batch): OrderInput[];
}

const PROTOCOL_AND_CREATOR_FEE_BPS = 125n;

/**
 * Calculates net SOL proceeds achievable from liquidating a given token position,
 * taking into account standard bonding curve swap formulas and 1.25% cumulative fees.
 */
function calculateNetSellValue(tokenAmount: bigint, virtualQuote: bigint, virtualToken: bigint): bigint {
  if (tokenAmount <= 0n || virtualToken <= 0n) {
    return 0n;
  }
  const grossSolOutput = (tokenAmount * virtualQuote) / (virtualToken + tokenAmount);
  const totalFeeDeduction = (grossSolOutput * PROTOCOL_AND_CREATOR_FEE_BPS + BPS - 1n) / BPS;
  return grossSolOutput - totalFeeDeduction;
}

export function createStrategy(params: Params = DEFAULT_PARAMS): Strategy {
  const cfg = params;
  const coinRegistry = new Map<Pubkey, TrackedCoinState>();
  const activePositionTracker = new Map<Pubkey, OpenPositionMetadata>();
  const pendingSellTransactions = new Set<Pubkey>();

  const targetStakeLamports = BigInt(cfg.stakeLamports);
  const minimumBuyLamports = BigInt(cfg.minBuyLamports);

  let firstSeenBlockTime: number | null = null;
  let currentBlockTime = 0;
  let totalFilledOrders = 0;

  function calculateDynamicSplitCount(): number {
    if (firstSeenBlockTime === null) {
      return cfg.baseSplit;
    }
    const elapsedSeconds = Math.max(0, Math.min(cfg.windowSeconds, currentBlockTime - firstSeenBlockTime));
    const expectedProratedFills = (cfg.fillTarget * elapsedSeconds) / cfg.windowSeconds;
    if (totalFilledOrders >= expectedProratedFills) {
      return cfg.baseSplit;
    }
    const fillDeficit = expectedProratedFills - totalFilledOrders;
    const additionalPieces = fillDeficit > cfg.fillTarget * 0.15 ? 2 : 1;
    return Math.min(cfg.maxSplit, cfg.baseSplit + additionalPieces);
  }

  function buildSplitSellOrderList(
    mint: Pubkey,
    totalTokens: bigint,
    splitPieces: number,
    remainingOrderSlots: number
  ): OrderInput[] {
    const piecesCount = BigInt(Math.max(1, Math.min(splitPieces, remainingOrderSlots)));
    const generatedOrders: OrderInput[] = [];
    const basePieceTokens = totalTokens / piecesCount;

    if (basePieceTokens === 0n) {
      return [{ side: 'sell', mint, token_amount: totalTokens, max_slippage_bps: 10_000 }];
    }

    for (let pieceIdx = 0n; pieceIdx < piecesCount; pieceIdx++) {
      const pieceAmount = (pieceIdx === piecesCount - 1n)
        ? totalTokens - basePieceTokens * (piecesCount - 1n)
        : basePieceTokens;
      generatedOrders.push({
        side: 'sell',
        mint,
        token_amount: pieceAmount,
        max_slippage_bps: 10_000,
      });
    }
    return generatedOrders;
  }

  function buildSplitBuyOrderList(
    mint: Pubkey,
    totalQuoteLamports: bigint,
    splitPieces: number,
    remainingOrderSlots: number
  ): OrderInput[] {
    let piecesCount = BigInt(Math.max(1, Math.min(splitPieces, remainingOrderSlots)));
    const minPieceFloor = BigInt(cfg.minPieceLamports);

    while (piecesCount > 1n && totalQuoteLamports / piecesCount < minPieceFloor) {
      piecesCount -= 1n;
    }

    const basePieceLamports = totalQuoteLamports / piecesCount;
    const generatedOrders: OrderInput[] = [];

    for (let pieceIdx = 0n; pieceIdx < piecesCount; pieceIdx++) {
      const pieceAmount = (pieceIdx === piecesCount - 1n)
        ? totalQuoteLamports - basePieceLamports * (piecesCount - 1n)
        : basePieceLamports;
      generatedOrders.push({
        side: 'buy',
        mint,
        quote_lamports: pieceAmount,
        max_slippage_bps: cfg.buySlippageBps,
      });
    }
    return generatedOrders;
  }

  function processBatchEvents(batch: Batch): void {
    for (const ev of batch.events) {
      if (ev.event === 'CreateEvent') {
        coinRegistry.set(ev.mint, {
          coinMint: ev.mint,
          creationSlot: ev.slot,
          creatorWallet: ev.creator,
          initialVirtualQuote: BigInt(ev.virtual_quote_reserves),
          initialVirtualToken: BigInt(ev.virtual_token_reserves),
          creatorTotalBuyLamports: 0n,
          totalTradeCount: 0,
          distinctBuyerWallets: new Set<Pubkey>(),
          aggregateBoughtLamports: 0n,
          externalSoldLamports: 0n,
          peakSingleSellRatioBps: 0n,
          creatorHasSold: false,
          mostRecentTradeSlot: ev.slot,
          recentTradeWindow: [],
          buyOrdersDispatchedCount: 0,
          totalLamportsDispatched: 0n,
          lastDecisionVirtualQuote: 0n,
          lastDecisionVirtualToken: 1n,
          lastBuyDecisionSlot: 0,
          isTerminated: false,
          bondingCurveCompleted: false,
        });
      } else if (ev.event === 'TradeEvent') {
        const coin = coinRegistry.get(ev.mint);
        if (coin === undefined) {
          continue;
        }
        const tradeSolAmount = BigInt(ev.sol_amount);
        coin.totalTradeCount += 1;
        coin.mostRecentTradeSlot = ev.slot;
        coin.recentTradeWindow.push({
          tradeSlot: ev.slot,
          isBuyOrder: ev.is_buy,
          solAmountLamports: tradeSolAmount,
          walletPubkey: ev.user,
        });

        const isCreatorWallet = ev.user === coin.creatorWallet;
        if (ev.is_buy) {
          coin.aggregateBoughtLamports += tradeSolAmount;
          if (isCreatorWallet && ev.slot === coin.creationSlot) {
            coin.creatorTotalBuyLamports += tradeSolAmount;
          } else if (!isCreatorWallet) {
            coin.distinctBuyerWallets.add(ev.user);
          }
        } else if (isCreatorWallet) {
          coin.creatorHasSold = true;
        } else {
          coin.externalSoldLamports += tradeSolAmount;
          const preSellRealQuote = BigInt(ev.real_quote_reserves) + tradeSolAmount;
          if (preSellRealQuote > 0n) {
            const sellImpactBps = (tradeSolAmount * BPS) / preSellRealQuote;
            if (sellImpactBps > coin.peakSingleSellRatioBps) {
              coin.peakSingleSellRatioBps = sellImpactBps;
            }
          }
        }
      } else {
        const coin = coinRegistry.get(ev.mint);
        if (coin !== undefined) {
          coin.bondingCurveCompleted = true;
          coin.isTerminated = true;
        }
      }
    }
  }

  function calculateRecentFlowMetrics(
    coin: TrackedCoinState,
    currentSlot: number
  ): { netLamportsFlow: bigint; uniqueBuyersCount: number } {
    const windowStartSlot = currentSlot - cfg.flowWindow;
    let prunedCount = 0;
    while (
      prunedCount < coin.recentTradeWindow.length &&
      coin.recentTradeWindow[prunedCount]!.tradeSlot <= windowStartSlot
    ) {
      prunedCount++;
    }
    if (prunedCount > 0) {
      coin.recentTradeWindow.splice(0, prunedCount);
    }

    let netFlow = 0n;
    const buyerSet = new Set<Pubkey>();
    for (const trade of coin.recentTradeWindow) {
      if (trade.isBuyOrder) {
        netFlow += trade.solAmountLamports;
        if (trade.walletPubkey !== coin.creatorWallet) {
          buyerSet.add(trade.walletPubkey);
        }
      } else {
        netFlow -= trade.solAmountLamports;
      }
    }
    return { netLamportsFlow: netFlow, uniqueBuyersCount: buyerSet.size };
  }

  function isBuyOrderCurrentlyPending(state: BotState, mint: Pubkey): boolean {
    for (const pendingOrder of state.pending.values()) {
      if (pendingOrder.order.mint === mint && pendingOrder.order.side === 'buy') {
        return true;
      }
    }
    return false;
  }

  function isSellOrderCurrentlyPending(state: BotState, mint: Pubkey): boolean {
    for (const pendingOrder of state.pending.values()) {
      if (pendingOrder.order.mint === mint && pendingOrder.order.side === 'sell') {
        return true;
      }
    }
    return false;
  }

  return {
    onBatch(state, batch) {
      processBatchEvents(batch);

      for (const ev of batch.events) {
        if (ev.block_time === null) continue;
        if (firstSeenBlockTime === null) {
          firstSeenBlockTime = ev.block_time;
        }
        if (ev.block_time > currentBlockTime) {
          currentBlockTime = ev.block_time;
        }
      }

      const orderOutputList: OrderInput[] = [];
      const batchMaxOrderCapacity = state.hello.caps.max_orders_per_batch;
      const networkTxFeeLamports = state.txFeeLamports();

      const batchReserveMarks = new Map<Pubkey, { vq: bigint; vt: bigint }>();
      for (const mark of batch.marks) {
        batchReserveMarks.set(mark.mint, {
          vq: BigInt(mark.virtual_quote_reserves),
          vt: BigInt(mark.virtual_token_reserves),
        });
      }

      for (const fill of batch.fills) {
        if (fill.client_id.startsWith('_')) {
          activePositionTracker.delete(fill.mint);
          pendingSellTransactions.delete(fill.mint);
          continue;
        }
        if (fill.status === 'filled') {
          totalFilledOrders += 1;
        }
        const positionMeta = activePositionTracker.get(fill.mint);
        if (fill.status !== 'rejected' && positionMeta !== undefined) {
          positionMeta.cumulativeTxFeesPaidLamports += BigInt(fill.tx_fee_lamports);
        }
        if (fill.side === 'buy' && fill.status === 'filled' && positionMeta === undefined) {
          const coinData = coinRegistry.get(fill.mint);
          activePositionTracker.set(fill.mint, {
            entrySlot: fill.slot,
            cumulativeTxFeesPaidLamports: BigInt(fill.tx_fee_lamports),
            highestObservedValueLamports: 0n,
            devSoldPriorToEntry: coinData?.creatorHasSold ?? false,
            firstTakeProfitExecuted: false,
          });
        }
      }

      for (const activeMint of [...pendingSellTransactions]) {
        if (!isSellOrderCurrentlyPending(state, activeMint)) {
          pendingSellTransactions.delete(activeMint);
        }
      }

      for (const heldMint of [...activePositionTracker.keys()]) {
        if (
          !state.positions.has(heldMint) &&
          !pendingSellTransactions.has(heldMint) &&
          !isBuyOrderCurrentlyPending(state, heldMint)
        ) {
          activePositionTracker.delete(heldMint);
        }
      }

      const activeOrderSplitCount = calculateDynamicSplitCount();

      // Stage 1: Evaluate Position Exits
      for (const [mint, currentPos] of state.positions) {
        if (orderOutputList.length >= batchMaxOrderCapacity) {
          break;
        }
        if (pendingSellTransactions.has(mint)) {
          continue;
        }

        const coin = coinRegistry.get(mint);
        let posMeta = activePositionTracker.get(mint);
        if (posMeta === undefined) {
          posMeta = {
            entrySlot: state.slot,
            cumulativeTxFeesPaidLamports: networkTxFeeLamports,
            highestObservedValueLamports: 0n,
            devSoldPriorToEntry: coin?.creatorHasSold ?? false,
            firstTakeProfitExecuted: false,
          };
          activePositionTracker.set(mint, posMeta);
        }

        let reserves = batchReserveMarks.get(mint);
        if (reserves === undefined) {
          const curveState = state.curves.get(mint);
          if (curveState === undefined) {
            continue;
          }
          reserves = {
            vq: curveState.virtual_quote_reserves,
            vt: curveState.virtual_token_reserves,
          };
        }

        const currentNetValue =
          calculateNetSellValue(currentPos.token_amount, reserves.vq, reserves.vt) - networkTxFeeLamports;
        const totalInvestedCostBasis = currentPos.cost_lamports + posMeta.cumulativeTxFeesPaidLamports;

        if (currentNetValue > posMeta.highestObservedValueLamports) {
          posMeta.highestObservedValueLamports = currentNetValue;
        }

        let triggerExit = false;

        if (totalInvestedCostBasis > 0n) {
          if (
            !posMeta.firstTakeProfitExecuted &&
            currentNetValue * BPS >= totalInvestedCostBasis * (BPS + BigInt(cfg.tp1Bps))
          ) {
            const partialTokenAmount = (currentPos.token_amount * BigInt(cfg.tp1PartBps)) / BPS;
            if (partialTokenAmount > 0n && partialTokenAmount < currentPos.token_amount) {
              orderOutputList.push({
                side: 'sell',
                mint,
                token_amount: partialTokenAmount,
                max_slippage_bps: 10_000,
              });
              pendingSellTransactions.add(mint);
              posMeta.firstTakeProfitExecuted = true;
              posMeta.highestObservedValueLamports = 0n;
              if (coin !== undefined) {
                coin.isTerminated = true;
              }
              continue;
            }
          }

          if (currentNetValue * BPS >= totalInvestedCostBasis * (BPS + BigInt(cfg.tpBps))) {
            triggerExit = true;
          }

          const dynamicStopLossThreshold = posMeta.firstTakeProfitExecuted
            ? BigInt(cfg.slAfterTp1Bps)
            : BigInt(cfg.slBps);

          if (currentNetValue * BPS <= totalInvestedCostBasis * (BPS - dynamicStopLossThreshold)) {
            triggerExit = true;
          }

          if (
            posMeta.highestObservedValueLamports * BPS >=
              totalInvestedCostBasis * (BPS + BigInt(cfg.trailArmBps)) &&
            currentNetValue * BPS <=
              posMeta.highestObservedValueLamports * (BPS - BigInt(cfg.trailBps))
          ) {
            triggerExit = true;
          }
        }

        if (state.slot - posMeta.entrySlot >= cfg.maxHold) {
          triggerExit = true;
        }

        if (coin !== undefined) {
          if (cfg.exitOnDevSell && coin.creatorHasSold && !posMeta.devSoldPriorToEntry) {
            triggerExit = true;
          }
          if (state.slot - coin.mostRecentTradeSlot >= cfg.staleSlots) {
            triggerExit = true;
          }
          if (calculateRecentFlowMetrics(coin, state.slot).netLamportsFlow < -BigInt(cfg.exitFlowLamports)) {
            triggerExit = true;
          }
        }

        if (!triggerExit) {
          continue;
        }

        const sellSlices = buildSplitSellOrderList(
          mint,
          currentPos.token_amount,
          activeOrderSplitCount,
          batchMaxOrderCapacity - orderOutputList.length
        );
        orderOutputList.push(...sellSlices);
        pendingSellTransactions.add(mint);

        if (coin !== undefined) {
          coin.isTerminated = true;
        }
      }

      // Stage 2: Evaluate New Entries and Tranche Additions
      let unreservedCashLamports =
        state.freeCashLamports() - networkTxFeeLamports * BigInt(orderOutputList.length);
      let concurrentPositionCount = state.committedPositionCount();

      for (const coin of coinRegistry.values()) {
        if (orderOutputList.length >= batchMaxOrderCapacity) {
          break;
        }
        if (coin.isTerminated || coin.bondingCurveCompleted) {
          continue;
        }

        const coinAgeSlots = state.slot - coin.creationSlot;
        const isTrancheAddition = coin.buyOrdersDispatchedCount > 0;

        if (!isTrancheAddition && coinAgeSlots > cfg.maxAge) {
          coin.isTerminated = true;
          continue;
        }
        if (coinAgeSlots < cfg.minAge) {
          continue;
        }

        if (isTrancheAddition) {
          if (coin.buyOrdersDispatchedCount > cfg.maxAdds) {
            continue;
          }
          if (
            !state.positions.has(coin.coinMint) ||
            pendingSellTransactions.has(coin.coinMint) ||
            isBuyOrderCurrentlyPending(state, coin.coinMint)
          ) {
            continue;
          }
        } else if (concurrentPositionCount >= state.hello.caps.max_open_positions) {
          continue;
        }

        const bondingCurve = state.curves.get(coin.coinMint);
        if (bondingCurve === undefined || bondingCurve.complete) {
          continue;
        }

        if (coin.creatorHasSold && (cfg.skipDevSold || isTrancheAddition)) {
          if (!isTrancheAddition) {
            coin.isTerminated = true;
          }
          continue;
        }

        const virtualQuote = bondingCurve.virtual_quote_reserves;
        const virtualToken = bondingCurve.virtual_token_reserves;

        if (isTrancheAddition) {
          if (state.slot - coin.lastBuyDecisionSlot < cfg.addDelay) {
            continue;
          }
          if (
            virtualQuote * coin.lastDecisionVirtualToken * BPS <
            coin.lastDecisionVirtualQuote * virtualToken * BigInt(10_000 + cfg.addStepBps)
          ) {
            continue;
          }
          if (calculateRecentFlowMetrics(coin, state.slot).netLamportsFlow < BigInt(cfg.addMinFlowLamports)) {
            continue;
          }

          const ceilingBuyLamports = state.maxBuyLamports(coin.coinMint);
          const plannedTrancheLamports = BigInt(cfg.addLamports);
          const allocatedLamports =
            plannedTrancheLamports < ceilingBuyLamports ? plannedTrancheLamports : ceilingBuyLamports;

          if (
            allocatedLamports < minimumBuyLamports ||
            unreservedCashLamports < allocatedLamports + networkTxFeeLamports * 6n
          ) {
            continue;
          }

          const trancheBuyOrders = buildSplitBuyOrderList(
            coin.coinMint,
            allocatedLamports,
            activeOrderSplitCount,
            batchMaxOrderCapacity - orderOutputList.length
          );
          orderOutputList.push(...trancheBuyOrders);
          unreservedCashLamports -= allocatedLamports + networkTxFeeLamports * BigInt(trancheBuyOrders.length);

          coin.buyOrdersDispatchedCount += 1;
          coin.totalLamportsDispatched += allocatedLamports;
          coin.lastDecisionVirtualQuote = virtualQuote;
          coin.lastDecisionVirtualToken = virtualToken;
          coin.lastBuyDecisionSlot = state.slot;
          continue;
        }

        // Rug-Pull & Conviction Filtering
        const realQuoteReserves = bondingCurve.real_quote_reserves;
        if (
          realQuoteReserves < BigInt(cfg.minRealSol) ||
          realQuoteReserves > BigInt(cfg.maxRealSol)
        ) {
          continue;
        }

        if (
          coin.creatorTotalBuyLamports < BigInt(cfg.minDevBuy) ||
          coin.creatorTotalBuyLamports > BigInt(cfg.maxDevBuy)
        ) {
          continue;
        }

        if (
          coin.totalTradeCount < cfg.minTrades ||
          coin.distinctBuyerWallets.size < cfg.minBuyers ||
          coin.distinctBuyerWallets.size > cfg.maxBuyers
        ) {
          continue;
        }

        if (
          coin.aggregateBoughtLamports > 0n &&
          coin.externalSoldLamports * BPS > coin.aggregateBoughtLamports * BigInt(cfg.maxSellRatioBps)
        ) {
          continue;
        }

        if (coin.peakSingleSellRatioBps > BigInt(cfg.maxBigSellBps)) {
          continue;
        }

        // Division-by-zero protection guards
        if (virtualToken <= 0n || coin.initialVirtualQuote <= 0n) {
          continue;
        }

        const priceRunupBps =
          (virtualQuote * coin.initialVirtualToken * BPS) / (virtualToken * coin.initialVirtualQuote);

        if (
          priceRunupBps > BigInt(cfg.maxRunupBps) ||
          priceRunupBps < BigInt(cfg.minRunupBps)
        ) {
          continue;
        }

        const recentFlow = calculateRecentFlowMetrics(coin, state.slot);
        if (
          recentFlow.netLamportsFlow < BigInt(cfg.minFlowLamports) ||
          recentFlow.uniqueBuyersCount < cfg.minRecentBuyers
        ) {
          continue;
        }

        const remainingStakeBudget = targetStakeLamports - coin.totalLamportsDispatched;
        if (remainingStakeBudget < minimumBuyLamports) {
          continue;
        }

        const maxExecutableBuy = state.maxBuyLamports(coin.coinMint);
        const targetOrderAmount =
          remainingStakeBudget < maxExecutableBuy ? remainingStakeBudget : maxExecutableBuy;

        if (targetOrderAmount < minimumBuyLamports) {
          continue;
        }

        if (unreservedCashLamports < targetOrderAmount + networkTxFeeLamports * 6n) {
          continue;
        }

        const initialBuyOrders = buildSplitBuyOrderList(
          coin.coinMint,
          targetOrderAmount,
          activeOrderSplitCount,
          batchMaxOrderCapacity - orderOutputList.length
        );

        orderOutputList.push(...initialBuyOrders);
        unreservedCashLamports -= targetOrderAmount + networkTxFeeLamports * BigInt(initialBuyOrders.length);

        coin.buyOrdersDispatchedCount += 1;
        coin.totalLamportsDispatched += targetOrderAmount;
        coin.lastDecisionVirtualQuote = virtualQuote;
        coin.lastDecisionVirtualToken = virtualToken;
        coin.lastBuyDecisionSlot = state.slot;

        concurrentPositionCount += 1;
      }

      return orderOutputList;
    },
  };
}
