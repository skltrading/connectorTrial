import * as Types from "./types"
import { DeribitSpotPublicConnector } from './deribit-spot-public-connector';

// Create an instance of the connector
const connector = new DeribitSpotPublicConnector("BTC-PERPETUAL", { interval: "100ms" });

// Define a message handler
const handleMessage = (messages: Types.Serializable[]) => {
    console.log('Received message:', messages);
};

// Connect to the WebSocket
connector.connect(handleMessage).then(() => {
    console.log('Connected');

    // Simulation
    setTimeout(() => {
        // Get version of Deribit API
        connector.getVersion()
        
        setTimeout(() => {
            // Unsubscribe all (Ticker, Trade, OrderBook) after 5seconds
            connector.unsubscribeToAllChannels()
        }, 5000)
    }, 5000)
}).catch((error) => {
    console.error('Failed to connect:', error);
});
