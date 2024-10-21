import GeminiPublicConnector from './gemini-public-connector.js';  // Import the Gemini connector

// Instantiate the GeminiPublicConnector class
const geminiConnector = new GeminiPublicConnector();

// Function to handle messages received from the WebSocket
function handleMessage(message) {
    const parsedMessage = JSON.parse(message);  // Parse the incoming message
    console.log('Received message:', JSON.stringify(parsedMessage, null, 2));  // Pretty-print the entire message
    
    // If there are events in the message, log them separately
    if (Array.isArray(parsedMessage.events)) {
        console.log('Received events:', JSON.stringify(parsedMessage.events, null, 2));
    }
}

// Connect to the WebSocket and handle incoming messages
geminiConnector.connect(handleMessage);

// Optionally stop the connection after some time (e.g., 30 seconds)
setTimeout(() => {
    geminiConnector.stop();
}, 30000);  // 30 seconds
