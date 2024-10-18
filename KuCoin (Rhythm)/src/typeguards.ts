import logger from "./logger";
import {
  AccountBalanceMessage,
  OrderBookData,
  OrderCancelMessage,
  OrderCreateMessage,
  TickerData,
  TradeData,
  WebSocketMessage,
} from "./types";

/**
 * Type guard to check if the message is a Ticker message.
 * @param data - The WebSocket message data.
 */
export function isTickerMessage(data: WebSocketMessage): data is TickerData {
  return data.topic?.startsWith("/market/ticker") ?? false;
}

/**
 * Type guard to check if the message is a Trade message.
 * @param data - The WebSocket message data.
 */
export function isTradeMessage(data: WebSocketMessage): data is TradeData {
  return data.topic?.startsWith("/market/match") ?? false;
}

/**
 * Type guard to check if the message is an Orderbook message.
 * @param data - The WebSocket message data.
 */
export function isOrderbookMessage(
  data: WebSocketMessage
): data is OrderBookData {
  return data.changes !== undefined && data.symbol !== undefined;
}

/**
 * Type guard for account balance messages.
 * @param data - The incoming message.
 * @returns True if the message is an account balance message.
 */
export function isAccountBalanceMessage(
  data: WebSocketMessage
): data is AccountBalanceMessage {
  return data.type === "account.balance";
}

/**
 * Type guard for order creation messages.
 * @param data - The incoming message.
 * @returns True if the message is an order creation message.
 */
export function isOrderCreateMessage(
  data: WebSocketMessage
): data is OrderCreateMessage {
  return data.type === "order.create";
}

/**
 * Type guard for order cancellation messages.
 * @param data - The incoming message.
 * @returns True if the message is an order cancellation message.
 */
export function isOrderCancelMessage(
  data: WebSocketMessage
): data is OrderCancelMessage {
  return data.type === "order.cancel";
}

/**
 * Handles unknown private events.
 * @param data - The unhandled data.
 */
export function handleUnknownPrivateEvent(data: WebSocketMessage) {
  logger.warn(`Unknown private event: ${JSON.stringify(data)}`);
}
