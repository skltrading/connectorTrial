import { throttle } from "lodash";
import { OrderBook } from "./order-book-manager";
import logger from "./logger";
import {
  TickerData,
  TradeData,
  OrderBookData,
  MatchEventData,
  MarketSnapshotData,
  WebSocketMessage,
} from "./types";

const orderBook = new OrderBook();

// Helper function to format the log time
const formatTime = (time: number): string => new Date(time).toISOString();

/**
 * Processes ticker data.
 * @param data - The ticker data.
 */
export function processTicker(data: TickerData) {
  const { symbol, price, time } = data;
  logger.info(
    `Ticker - Symbol: ${symbol}, Price: ${price}, Time: ${formatTime(time)}`
  );
}

/**
 * Processes trade (match) data.
 * @param data - The trade data.
 */
export function processTrade(data: TradeData) {
  const { symbol, price, size, time } = data;
  logger.info(
    `Trade - Symbol: ${symbol}, Price: ${price}, Size: ${size}, Time: ${formatTime(
      time
    )}`
  );
}

/**
 * Processes order book data with throttling.
 * @param data - The order book data.
 */
export const processOrderbook = throttle((data: OrderBookData) => {
  const { symbol, changes, sequenceStart, sequenceEnd, time } = data;
  orderBook.update(changes);
  logger.info(
    `Orderbook Update - Symbol: ${symbol}, Sequence: ${sequenceStart}-${sequenceEnd}, Time: ${formatTime(
      time
    )}`
  );
  logger.info(`Top Bids: ${JSON.stringify(orderBook.getBids().slice(0, 5))}`);
  logger.info(`Top Asks: ${JSON.stringify(orderBook.getAsks().slice(0, 5))}`);
}, 5000); // Throttle logs to every 5 seconds

/**
 * Processes match events (trade execution).
 * @param data - The match event data.
 */
export function processMatchEvent(data: MatchEventData) {
  const { symbol, price, size, side, tradeId, time } = data;
  logger.info(
    `Match - Symbol: ${symbol}, Side: ${side}, Price: ${price}, Size: ${size}, Trade ID: ${tradeId}, Time: ${formatTime(
      time
    )}`
  );
  // Further processing or storage logic
}

/**
 * Processes market snapshot events (best ask/bid updates).
 * @param data - The market snapshot data.
 */
export function processMarketSnapshot(data: MarketSnapshotData) {
  const { symbol, bestAsk, bestBid, price, time } = data;
  logger.info(
    `Market Snapshot - Symbol: ${symbol}, Best Ask: ${bestAsk}, Best Bid: ${bestBid}, Price: ${price}, Time: ${formatTime(
      time
    )}`
  );
  // Further processing or storage logic
}

/**
 * Handles unknown or unhandled event types.
 * @param data - The unhandled data.
 */
export function handleUnknownEvent(data: any) {
  if (data.type === "match") {
    processMatchEvent(data);
  } else if (data.bestAsk !== undefined && data.bestBid !== undefined) {
    processMarketSnapshot(data);
  } else {
    logger.warn(`Unhandled event type: ${JSON.stringify(data)}`);
  }
}

/**
 * Processes account balance messages.
 * @param data - The account balance data.
 */
export function processAccountBalance(data: WebSocketMessage) {
  const { data: accountData } = data;
  logger.info(`Account Balance - Data: ${JSON.stringify(accountData)}`);
}

/**
 * Processes order creation messages.
 * @param data - The order creation data.
 */
export function processOrderCreate(data: WebSocketMessage) {
  const { data: orderData } = data;
  logger.info(`Order Created - Data: ${JSON.stringify(orderData)}`);
}

/**
 * Processes order cancellation messages.
 * @param data - The order cancellation data.
 */
export function processOrderCancel(data: WebSocketMessage) {
  const { data: cancelData } = data;
  logger.info(`Order Canceled - Data: ${JSON.stringify(cancelData)}`);
}
