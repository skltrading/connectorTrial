// src/eventHandlers.ts

import { WebSocketMessage } from '../types';
import { isTickerMessage, isTradeMessage, isOrderbookMessage } from '../typeguards';
import { processTicker, processTrade, processOrderbook, handleUnknownEvent } from '../processors';

export function onMessage(data: WebSocketMessage) {
    if (isTickerMessage(data)) {
        processTicker(data);
    } else if (isTradeMessage(data)) {
        processTrade(data);
    } else if (isOrderbookMessage(data)) {
        processOrderbook(data);
    } else {
        handleUnknownEvent(data);
    }
}
