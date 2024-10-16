import { WebSocketMessage } from './types';

/**
 * Type guard to check if the message is a Ticker message.
 * @param data - The WebSocket message data.
 */
export function isTickerMessage(data: WebSocketMessage): boolean {
    return data.topic?.startsWith('/market/ticker') ?? false;
}

/**
 * Type guard to check if the message is a Trade message.
 * @param data - The WebSocket message data.
 */
export function isTradeMessage(data: WebSocketMessage): boolean {
    return data.topic?.startsWith('/market/match') ?? false;
}

/**
 * Type guard to check if the message is an Orderbook message.
 * @param data - The WebSocket message data.
 */
export function isOrderbookMessage(data: WebSocketMessage): boolean {
    return data.changes !== undefined && data.symbol !== undefined;
}