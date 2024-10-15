import * as Types from "./types"
import { DeribitSpotPrivateConnector } from './deribit-spot-private-connector';

// Create an instance of the connector
const connector = new DeribitSpotPrivateConnector();

// Define a message handler
const handleMessage = (messages: Types.Serializable[]) => {
    console.log('Received message:', messages);
};

// Connect to the WebSocket
connector.connect(handleMessage).then((success) => {
    console.log('Connected:', success);


}).catch((error) => {
    console.error('Failed to connect:', error);
});
