import { TickerData } from '../types';
import { isTickerMessage, isTradeMessage, isOrderbookMessage } from '../typeguards';
import { processTicker, processTrade, processOrderbook, handleUnknownEvent } from '../processors';

export function onMessage(data: any) {
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
