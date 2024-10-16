import { throttle } from 'lodash';
import { OrderBook } from './order-book-manager';

const orderBook = new OrderBook();


/**
 * Processes ticker data.
 * @param data - The ticker data.
 */
export function processTicker(data: any) {
    const { symbol, price, time } = data;
    console.log(`Ticker - Symbol: ${symbol}, Price: ${price}, Time: ${new Date(time).toISOString()}`);
    // Further processing or storage logic
}

/**
 * Processes trade (match) data.
 * @param data - The trade data.
 */
export function processTrade(data: any) {
    const { symbol, price, size, time } = data;
    console.log(`Trade - Symbol: ${symbol}, Price: ${price}, Size: ${size}, Time: ${new Date(time).toISOString()}`);
    // Further processing or storage logic
}

/**
 * Processes order book data with throttling.
 * @param data - The order book data.
 */
export const processOrderbook = throttle((data: any) => {
    const { symbol, changes, sequenceStart, sequenceEnd, time } = data;
    orderBook.update(changes);
    console.log(`Orderbook Update - Symbol: ${symbol}, Sequence: ${sequenceStart}-${sequenceEnd}, Time: ${new Date(time).toISOString()}`);
    console.log(`Top Bids: ${JSON.stringify(orderBook.getBids().slice(0, 5))}`);
    console.log(`Top Asks: ${JSON.stringify(orderBook.getAsks().slice(0, 5))}`);
    // Further processing or storage logic
}, 1000); // Process at most once every second

/**
 * Handles unknown or unhandled event types.
 * @param data - The unhandled data.
 */
export function handleUnknownEvent(data: any) {
    console.warn(`Unhandled event type: ${JSON.stringify(data)}`);
    // Optional: Implement additional logic or ignore
}