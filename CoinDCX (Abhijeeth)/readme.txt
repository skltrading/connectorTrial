
# CoinDCX Connector Documentation

## Overview

This repository hosts the implementation for two types of connectors for the CoinDCX exchange:
- **Public Connector**: Allows for fetching real-time market data using WebSocket.
- **Private Connector**: Enables authenticated trading operations using both WebSocket and REST API.

These connectors simplify integration, enabling users to access market insights and execute trades on CoinDCX with ease.

## Features

### Public Connector
- **Real-Time Market Data**: 
  - Stream price fluctuations, order book updates, trade activities, and candlestick formations.
- **Simple Subscription Management**: 
  - Effortlessly manage subscriptions to desired market data channels.
- **Auto-Reconnect**: 
  - Automatically re-establishes the WebSocket connection if it drops.

### Private Connector
- **Authenticated WebSocket Connection**: 
  - Connect securely to private CoinDCX channels for personalized account updates.
- **REST API Capabilities**: 
  - Support for order placement, order cancellation, balance inquiries, and active order retrieval.
- **Secure HMAC Authentication**: 
  - Utilizes HMAC SHA-256 signatures for enhanced security during data exchanges.

## Installation

To install the required dependencies, run the following command:
```bash
npm install axios socket.io-client crypto

## Usage

### Public Connector

#### Example
```typescript
import { CoinDCXPublicConnector } from './connectors/public/coindcx-public-connector';

const config = {
    group: { name: 'BTC' },
    config: {
        quoteAsset: 'USDT',
        connectorType: 'CoinDCX'
    }
};

const connector = new CoinDCXPublicConnector(config.group, config.config);

connector.connect((messages) => {
    console.log('Received messages:', messages);
});

### Private Connector

#### Example
```typescript
import { CoinDCXPrivateConnector } from './connectors/private/coindcx-private-connector';

const config = {
    group: { name: 'BTC' },
    config: {
        quoteAsset: 'USDT',
        connectorType: 'CoinDCX'
    },
    credential: {
        key: 'your_api_key',
        secret: 'your_api_secret'
    }
};

const privateConnector = new CoinDCXPrivateConnector(config.group, config.config, config.credential);

privateConnector.connect((messages) => {
    console.log('Private message:', messages);
});

// Example: Placing an order
privateConnector.placeOrders({
    orders: [{
        side: 'buy',
        price: 20000,
        size: 0.1,
        symbol: 'BTCUSDT'
    }]
});
