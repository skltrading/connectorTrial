import { WebSocketMessage } from "../types";
import {
  isAccountBalanceMessage,
  isOrderCreateMessage,
  isOrderCancelMessage,
  handleUnknownPrivateEvent,
} from "../typeguards";
import {
  processAccountBalance,
  processOrderCreate,
  processOrderCancel,
} from "../processors";

/**
 * Handles incoming WebSocket messages for private events.
 * @param data - The parsed WebSocket message.
 */
export function onPrivateMessage(data: WebSocketMessage) {
  if (isAccountBalanceMessage(data)) {
    processAccountBalance(data);
  } else if (isOrderCreateMessage(data)) {
    processOrderCreate(data);
  } else if (isOrderCancelMessage(data)) {
    processOrderCancel(data);
  } else {
    handleUnknownPrivateEvent(data);
  }
}
