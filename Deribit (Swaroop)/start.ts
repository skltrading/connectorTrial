import { DeribitSpotPublicConnector } from './deribit-spot-public-connector';

// Create an instance of the connector
const connector = new DeribitSpotPublicConnector();

// Define a message handler
const handleMessage = (messages: any[]) => {
    console.log('Received message:', messages);
};

// Connect to the WebSocket
connector.connect(handleMessage).then((success) => {
    console.log('Connected:', success);


}).catch((error) => {
    console.error('Failed to connect:', error);
});
