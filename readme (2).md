# Comprehensive Guide to Building Exchange Connectors for Our Trading Infrastructure

## Introduction

Welcome to the development team! This guide is designed to help you build **public** and **private exchange connectors** for our market-making infrastructure. Exchange connectors are critical components that interact with exchanges to retrieve market data and execute trades.

This guide will walk you through the general structure and steps needed to implement both public and private connectors, using provided code examples and incorporating best practices observed from existing implementations. As you develop the connectors, you should also consult the exchange-specific API documentation to handle any nuances or unique requirements. Please note that this guide is not a "one size fits all" approach. Each Exchnage might require very diffrent approaches.

---

## Table of Contents

1. [Overview of Exchange Connectors](#overview)
   - [Public Connectors](#public-connectors)
   - [Private Connectors](#private-connectors)
2. [Prerequisites](#prerequisites)
3. [Common Components](#common-components)
4. [Building a Public Connector](#building-public-connector)
   - [1. Set Up the Connector Class](#public-step1)
   - [2. Define Constructor and Member Variables](#public-step2)
   - [3. Establish the WebSocket Connection](#public-step3)
   - [4. Subscribe to Market Data Channels](#public-step4)
   - [5. Handle Incoming Messages](#public-step5)
   - [6. Implement Event Type Determination](#public-step6)
   - [7. Create Serializable Events](#public-step7)
   - [8. Handle Authentication (If Required)](#public-step8)
   - [9. Implement Reconnection Logic](#public-step9)
   - [10. Implement the `stop` Method](#public-step10)
   - [11. Update the Main Public Connector](#public-step11)
   - [12. Testing and Validation](#public-step12)
5. [Building a Private Connector](#building-private-connector)
   - [1. Set Up the Connector Class](#private-step1)
   - [2. Define Constructor and Member Variables](#private-step2)
   - [3. Establish the WebSocket and REST Connections](#private-step3)
   - [4. Handle Authentication](#private-step4)
     - [Handling Listen Keys or Session Tokens](#listen-keys)
   - [5. Subscribe to Private Channels](#private-step5)
   - [6. Implement RPC Methods](#private-step6)
     - [Place Orders](#place-orders)
     - [Implementing Order Batching](#order-batching)
     - [Cancel Orders](#cancel-orders)
     - [Get Open Orders](#get-open-orders)
     - [Get Balance](#get-balance)
   - [7. Handle Incoming Messages](#private-step7)
   - [8. Implement Reconnection Logic](#private-step8)
     - [Ping Mechanism and Cleanup](#ping-mechanism)
   - [9. Implement the `stop` Method](#private-step9)
   - [10. Update the Main Private Connector](#private-step10)
   - [11. Testing and Validation](#private-step11)
6. [Best Practices](#best-practices)
7. [Conclusion](#conclusion)
8. [Appendix](#appendix)

---

<a name="overview"></a>
## 1. Overview of Exchange Connectors

Exchange connectors are divided into two categories:

### <a name="public-connectors"></a>Public Connectors

- **Purpose**: Connect to an exchange's public market data feeds to receive real-time information such as order books, trades, and tickers.
- **Responsibilities**:
  - Establish WebSocket connections to public APIs.
  - Subscribe to market data channels.
  - Process and standardize incoming data.
  - Handle reconnection logic and error handling.

### <a name="private-connectors"></a>Private Connectors

- **Purpose**: Interact with an exchange's private APIs to execute trades, manage orders, and retrieve account information.
- **Responsibilities**:
  - Authenticate with the exchange using API keys and secrets.
  - Establish WebSocket and/or REST connections for private endpoints.
  - Implement methods to place orders, cancel orders, retrieve open orders, and get balances.
  - Handle order status updates and account events.
  - Manage reconnection and error handling.

---

<a name="prerequisites"></a>
## 2. Prerequisites

- **Proficiency in TypeScript and Node.js**.
- **Understanding of WebSocket and RESTful APIs**.
- **Familiarity with asynchronous programming and event-driven architecture**.
- **Access to exchange-specific API documentation**.
- **Knowledge of our internal data types and interfaces from the `skl-shared` library**.

---

<a name="common-components"></a>
## 3. Common Components

Both public and private connectors share some common elements:

- **Connector Interfaces**: Implement the appropriate interface (`PublicExchangeConnector` or `PrivateExchangeConnector`) to ensure consistency.
- **Symbol and Side Mapping**: Use utility functions to map exchange-specific symbols and sides to our internal representations.
- **Event Handling**: Process incoming messages and convert them to our standardized `Serializable` types.
- **Error Handling and Logging**: Implement comprehensive error handling and use the `Logger` utility for logging.
- **Reconnection Logic**: Ensure connectors can recover from disconnections automatically.

---

<a name="building-public-connector"></a>
## 4. Building a Public Connector

<a name="public-step1"></a>
### 1. Set Up the Connector Class

- **Create a new class** in `src/connectors/public/`.
- **Implement the `PublicExchangeConnector` interface**.

```typescript
import {
    PublicExchangeConnector,
    ConnectorConfiguration,
    ConnectorGroup,
    Serializable,
} from 'skl-shared';

export class ExchangeNamePublicConnector implements PublicExchangeConnector {
    // Implementation
}
```

---

<a name="public-step2"></a>
### 2. Define Constructor and Member Variables

- **Constructor Parameters**:
  - `group: ConnectorGroup`
  - `config: ConnectorConfiguration`
  - `credential?: Credential` (if authentication is required)

- **Member Variables**:
  - Exchange symbols (`exchangeSymbol`, `sklSymbol`)
  - WebSocket endpoints
  - WebSocket client instance
  - State variables (e.g., order book levels)

```typescript
constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential?: Credential,
) {
    this.exchangeSymbol = getExchangeSymbol(this.group, this.config);
    this.sklSymbol = getSklSymbol(this.group, this.config);
}
```

---

<a name="public-step3"></a>
### 3. Establish the WebSocket Connection

- **Initialize the WebSocket client**.
- **Implement the `connect` method**, which accepts a callback `onMessage` to handle incoming data.

```typescript
public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
    this.websocket = new WebSocket(this.publicWebsocketUrl);

    this.websocket.on('open', () => {
        this.subscribeToChannels();
    });

    this.websocket.on('message', (data: string) => {
        this.handleMessage(data, onMessage);
    });

    this.websocket.on('error', (error: Error) => {
        // Handle errors
    });

    this.websocket.on('close', () => {
        // Reconnect logic
    });
}
```

---

<a name="public-step4"></a>
### 4. Subscribe to Market Data Channels

- **Determine necessary channels** (e.g., trades, order book updates, tickers).
- **Format subscription messages** according to the exchange's API specification.
- **Send subscription messages upon connection**.

```typescript
private subscribeToChannels(): void {
    const channels = [
        `trades.${this.exchangeSymbol}`,
        `orderbook.${this.exchangeSymbol}`,
        `ticker.${this.exchangeSymbol}`,
    ];

    const subscriptionMessage = {
        method: 'SUBSCRIBE',
        params: channels,
        // Include authentication if required
    };

    this.websocket.send(JSON.stringify(subscriptionMessage));
}
```

---

<a name="public-step5"></a>
### 5. Handle Incoming Messages

- **Parse messages and determine event type**.
- **Convert data into `Serializable` types**.
- **Invoke `onMessage` callback**.

```typescript
private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
    const message = JSON.parse(data);
    const eventType = this.getEventType(message);

    if (eventType) {
        const serializableMessages = this.createSerializableEvents(eventType, message);
        if (serializableMessages.length > 0) {
            onMessage(serializableMessages);
        }
    } else {
        // Log unrecognized messages
    }
}
```

---

<a name="public-step6"></a>
### 6. Implement Event Type Determination

- **Map incoming messages to `SklEvent` types**.
- **Handle special cases or message formats**.

```typescript
private getEventType(message: any): SklEvent | null {
    if (message.type === 'trade') {
        return 'Trade';
    } else if (message.type === 'orderbook') {
        return 'TopOfBook';
    } else if (message.type === 'ticker') {
        return 'Ticker';
    } else if (message.error) {
        logger.error(`Error message received: ${message.error}`);
        return null;
    } else if (message.event === 'subscription') {
        logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
        return null;
    }
    return null;
}
```

---

<a name="public-step7"></a>
### 7. Create Serializable Events

- **Transform exchange data into internal structures**.
- **Use utility functions for symbol and side mappings**.

```typescript
private createSerializableEvents(eventType: SklEvent, message: any): Serializable[] {
    switch (eventType) {
        case 'Trade':
            return [this.createTrade(message)];
        case 'TopOfBook':
            return [this.createTopOfBook(message)];
        case 'Ticker':
            return [this.createTicker(message)];
        default:
            return [];
    }
}

private createTrade(message: any): Trade {
    return {
        symbol: this.sklSymbol,
        connectorType: 'ExchangeName',
        event: 'Trade',
        price: parseFloat(message.price),
        size: parseFloat(message.size),
        side: mapExchangeSide(message.side),
        timestamp: new Date(message.timestamp).getTime(),
    };
}
```

---

<a name="public-step8"></a>
### 8. Handle Authentication (If Required)

- **Implement authentication mechanisms**.
- **Sign messages and requests using API keys and secrets**.

```typescript
private signMessage(message: any): any {
    if (this.credential) {
        // Implement signing logic
        // For example, add authentication headers or parameters
    }
    return message;
}
```

---

<a name="public-step9"></a>
### 9. Implement Reconnection Logic

- **Handle WebSocket `close` events**.
- **Attempt reconnection after a delay**.

```typescript
this.websocket.on('close', () => {
    setTimeout(() => {
        this.connect(onMessage);
    }, 1000); // Reconnect after 1 second
});
```

---

<a name="public-step10"></a>
### 10. Implement the `stop` Method

- **Unsubscribe from channels** if the exchange supports it.
- **Close the WebSocket connection**.

```typescript
public async stop(): Promise<void> {
    const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [
            `trades.${this.exchangeSymbol}`,
            `orderbook.${this.exchangeSymbol}`,
            `ticker.${this.exchangeSymbol}`,
        ],
    };
    this.websocket.send(JSON.stringify(unsubscribeMessage));
    this.websocket.close();
}
```

---

<a name="public-step11"></a>
### 11. Update the Main Public Connector

- **Register the new connector** in `public-connector-main.ts`.

```typescript
// In public-connector-main.ts
const connectorInstance: PublicExchangeConnector = ConnectorFactory.getPublicConnector(
    connectorGroup,
    connectorConfig,
    credential,
);
```

---

<a name="public-step12"></a>
### 12. Testing and Validation

- **Test the connector using the exchange's testnet** if available.
- **Validate data accuracy** by comparing received data with the exchange's official platforms.
- **Monitor for errors and edge cases**.

---

<a name="building-private-connector"></a>
## 5. Building a Private Connector

<a name="private-step1"></a>
### 1. Set Up the Connector Class

- **Create a new class** in `src/connectors/private/`.
- **Implement the `PrivateExchangeConnector` interface**.

```typescript
import {
    PrivateExchangeConnector,
    ConnectorConfiguration,
    ConnectorGroup,
    Credential,
    Serializable,
} from 'skl-shared';

export class ExchangeNamePrivateConnector implements PrivateExchangeConnector {
    // Implementation
}
```

---

<a name="private-step2"></a>
### 2. Define Constructor and Member Variables

- **Constructor Parameters**:
  - `group: ConnectorGroup`
  - `config: ConnectorConfiguration`
  - `credential: Credential` (required for authentication)

- **Member Variables**:
  - Exchange symbols (`exchangeSymbol`, `sklSymbol`)
  - WebSocket and REST endpoints
  - API credentials
  - WebSocket client instance
  - State variables

```typescript
constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential: Credential,
) {
    this.exchangeSymbol = getExchangeSymbol(this.group, this.config);
    this.sklSymbol = getSklSymbol(this.group, this.config);
}
```

---

<a name="private-step3"></a>
### 3. Establish the WebSocket and REST Connections

- **Initialize WebSocket and REST clients**.
- **Implement the `connect` method**.

```typescript
public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
    this.websocket = new WebSocket(this.privateWebSocketUrl);

    this.websocket.on('open', async () => {
        await this.authenticate();
    });

    this.websocket.on('message', (data: string) => {
        this.handleMessage(data, onMessage);
    });

    this.websocket.on('error', (error: Error) => {
        // Handle errors
    });

    this.websocket.on('close', () => {
        // Reconnection logic
    });
}
```

---

<a name="private-step4"></a>
### 4. Handle Authentication

- **Implement authentication during WebSocket connection**.
- **Sign messages and requests using API keys and secrets**.

```typescript
private async authenticate(): Promise<void> {
    // Authentication logic, e.g., sending login messages
    const timestamp = Date.now();
    const signature = this.generateSignature(timestamp);
    const authMessage = {
        op: 'login',
        args: [this.credential.key, timestamp, signature],
    };
    this.websocket.send(JSON.stringify(authMessage));
}
```

#### <a name="listen-keys"></a>Handling Listen Keys or Session Tokens

- **Obtain Listen Key**: Before establishing a WebSocket connection, make an authenticated REST API call to obtain a `listenKey` or session token.
- **Include in WebSocket URL**: Append the `listenKey` as a query parameter in the WebSocket URL.
- **Manage Listen Keys**:
  - **Rotation**: Implement logic to renew the `listenKey` before expiration.
  - **Cleanup**: Delete or invalidate old listen keys to prevent resource leaks.

**Example**:

```typescript
private async getListenKey(): Promise<string> {
    const response = await this.postRequest('/userDataStream', {});
    return response.listenKey;
}

public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
    const listenKey = await this.getListenKey();
    this.websocket = new WebSocket(`${this.privateWebSocketUrl}?listenKey=${listenKey}`);

    this.websocket.on('open', () => {
        this.startPingInterval();
        this.subscribeToPrivateChannels();
    });

    // Continue with WebSocket setup...
}
```

---

<a name="private-step5"></a>
### 5. Subscribe to Private Channels

- **Subscription Messages**: Format subscription messages according to the exchange's private WebSocket API.
- **Include Authentication Details**: Some exchanges may require additional authentication within the subscription message.

**Example**:

```typescript
private subscribeToPrivateChannels(): void {
    const channels = [
        'spot@private.deals.v3.api',
        'spot@private.orders.v3.api',
    ];
    const subscriptionMessage = {
        method: 'SUBSCRIPTION',
        params: channels,
    };
    this.websocket.send(JSON.stringify(subscriptionMessage));
}
```

---

<a name="private-step6"></a>
### 6. Implement RPC Methods

Implement methods required by the `PrivateExchangeConnector` interface:

#### <a name="place-orders"></a>Place Orders

```typescript
public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    const orders = request.orders.map(order => {
        return {
            symbol: this.exchangeSymbol,
            quantity: order.size.toFixed(8),
            price: order.price.toFixed(8),
            side: mapSide(order.side),
            type: mapOrderType(order.type),
        };
    });

    // Implement order batching if necessary
    // ...

    const endpoint = '/api/v3/order/batch';
    return await this.postRequest(endpoint, { orders });
}
```

#### <a name="order-batching"></a>Implementing Order Batching

- **Batch Size Limits**: Check the exchange's API documentation for any limits on the number of orders per request.
- **Batching Logic**:
  - **Chunk Orders**: Split the array of orders into smaller chunks based on the allowed batch size.
  - **Sequential Requests**: Send batch requests sequentially or in parallel, depending on API rate limits.

**Example**:

```typescript
public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    const maxBatchSize = 20; // Example limit
    const orders = request.orders.map(order => ({
        // Map order fields...
    }));

    const batches = this.chunkArray(orders, maxBatchSize);

    const promises = batches.map(batch => {
        return this.postRequest('/batchOrders', { batchOrders: JSON.stringify(batch) });
    });

    const results = await Promise.all(promises);
    return results;
}

private chunkArray(array: any[], chunkSize: number): any[] {
    const results = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        results.push(array.slice(i, i + chunkSize));
    }
    return results;
}
```

#### <a name="cancel-orders"></a>Cancel Orders

```typescript
public async deleteAllOrders(request: CancelOrdersRequest): Promise<any> {
    const endpoint = '/api/v3/openOrders';
    return await this.deleteRequest(endpoint, { symbol: this.exchangeSymbol });
}
```

#### <a name="get-open-orders"></a>Get Open Orders

```typescript
public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
    const endpoint = '/api/v3/openOrders';
    const response = await this.getRequest(endpoint, { symbol: this.exchangeSymbol });

    return response.map(order => ({
        event: 'OrderStatusUpdate',
        connectorType: 'ExchangeName',
        symbol: this.sklSymbol,
        orderId: order.orderId,
        sklOrderId: order.clientOrderId,
        state: mapOrderState(order.status),
        side: mapExchangeSide(order.side),
        price: parseFloat(order.price),
        size: parseFloat(order.origQty),
        notional: parseFloat(order.price) * parseFloat(order.origQty),
        filled_price: parseFloat(order.price),
        filled_size: parseFloat(order.executedQty),
        timestamp: order.time,
    }));
}
```

#### <a name="get-balance"></a>Get Balance

```typescript
public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
    const endpoint = '/api/v3/account';
    const response = await this.getRequest(endpoint, {});

    const baseAsset = this.group.name;
    const quoteAsset = this.config.quoteAsset;

    const base = response.balances.find(b => b.asset === baseAsset) || { free: '0', locked: '0' };
    const quote = response.balances.find(b => b.asset === quoteAsset) || { free: '0', locked: '0' };

    const baseBalance = parseFloat(base.free) + parseFloat(base.locked);
    const quoteBalance = parseFloat(quote.free) + parseFloat(quote.locked);

    const baseValue = baseBalance * request.lastPrice;
    const totalValue = baseValue + quoteBalance;
    const inventoryPercentage = (baseValue / totalValue) * 100;

    return {
        event: 'BalanceResponse',
        symbol: this.sklSymbol,
        baseBalance,
        quoteBalance,
        inventory: inventoryPercentage,
        timestamp: Date.now(),
    };
}
```

---

<a name="private-step7"></a>
### 7. Handle Incoming Messages

- **Process messages related to order status updates and account events**.
- **Use robust parsing to determine event types**.

```typescript
private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
    const message = JSON.parse(data);
    const eventType = this.getEventType(message);

    if (eventType === 'OrderStatusUpdate') {
        const orderStatusUpdate = this.createOrderStatusUpdate(message);
        onMessage([orderStatusUpdate]);
    } else {
        // Handle other events or log unrecognized messages
    }
}

private getEventType(message: any): SklEvent | null {
    if (message.error) {
        logger.error(`Error message received: ${message.error}`);
        return null;
    } else if (message.event === 'subscription') {
        logger.info(`Subscription confirmed: ${JSON.stringify(message)}`);
        return null;
    } else if (message.type === 'orderUpdate') {
        return 'OrderStatusUpdate';
    }
    // Additional event type checks...
    return null;
}
```

---

<a name="private-step8"></a>
### 8. Implement Reconnection Logic

- **Handle WebSocket `close` events**.
- **Re-authenticate upon reconnection**.
- **Ensure subscriptions are re-established**.

#### <a name="ping-mechanism"></a>Ping Mechanism and Cleanup

- **Ping Mechanism**:
  - Implement a `setInterval` to send ping messages at the required interval.
  - Keep the WebSocket connection alive as per exchange requirements.

- **Cleanup on Reconnection**:
  - Clear any existing intervals or timeouts before attempting to reconnect.
  - Reinitialize necessary resources.

**Example**:

```typescript
private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
        this.websocket.send(JSON.stringify({ method: 'PING' }));
    }, 10000); // Ping every 10 seconds
}

private stopPingInterval(): void {
    if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
    }
}

public async connect(onMessage: (messages: Serializable[]) => void): Promise<void> {
    // Existing connection logic...
    this.websocket.on('open', () => {
        this.startPingInterval();
        // Subscribe to channels...
    });

    this.websocket.on('close', () => {
        this.stopPingInterval();
        setTimeout(() => {
            this.connect(onMessage);
        }, 1000); // Reconnect after 1 second
    });
}
```

---

<a name="private-step9"></a>
### 9. Implement the `stop` Method

- **Unsubscribe from private channels**.
- **Cancel all open orders if necessary**.
- **Close WebSocket and clean up resources**.

```typescript
public async stop(): Promise<void> {
    // Unsubscribe from channels
    const unsubscribeMessage = {
        method: 'UNSUBSCRIBE',
        params: [
            `orders.${this.exchangeSymbol}`,
        ],
    };
    this.websocket.send(JSON.stringify(unsubscribeMessage));

    // Optionally cancel all open orders
    await this.deleteAllOrders({
        symbol: this.sklSymbol,
        event: 'CancelOrdersRequest',
        timestamp: Date.now(),
        connectorType: 'ExchangeName',
    });

    // Stop ping interval
    this.stopPingInterval();

    this.websocket.close();
}
```

---

<a name="private-step10"></a>
### 10. Update the Main Private Connector

- **Register the new connector** in `private-connector-main.ts`.

```typescript
// In private-connector-main.ts
const connectorInstance: PrivateExchangeConnector = ConnectorFactory.getPrivateConnector(
    connectorGroup,
    connectorConfig,
    credential,
);
```

---

<a name="private-step11"></a>
### 11. Testing and Validation

- **Use testnet or sandbox environments** if available.
- **Use SKL's CLI Locally to test private and public connections**
- **Verify order placement, cancellation, and updates**.
- **Ensure balances and open orders are accurately retrieved**.
- **Monitor for errors and handle edge cases**, such as network interruptions or unexpected message formats.

---

<a name="best-practices"></a>
## 6. Best Practices

- **Consult Exchange API Documentation**: Always refer to the official API docs for the latest information.
- **Handle Rate Limits**: Be mindful of the exchange's rate limits to avoid throttling or bans.
- **Secure Credentials**: Never hard-code credentials; use environment variables or secure storage mechanisms.
- **Error Handling**:
  - Implement comprehensive error handling and logging to facilitate debugging and maintenance.
  - Use `try-catch` blocks in HTTP requests.
  - Log errors with sufficient detail.
- **Code Reusability**: Utilize shared utilities and mappings to reduce code duplication and improve maintainability.
- **Resource Cleanup**: Ensure all resources, such as WebSocket connections and intervals, are properly cleaned up to prevent memory leaks.
- **Compliance**: Ensure adherence to exchange terms of service and data usage policies.

---

<a name="conclusion"></a>
## 7. Conclusion

By following this guide and leveraging the existing code examples, you should be able to implement both public and private connectors for any exchange. Remember to:

- **Understand exchange-specific nuances** and adapt your implementation accordingly.
- **Test thoroughly** in safe environments before deploying to production.
- **Ensure compliance** with the exchange's terms of service.
- **Collaborate with the team**: Don't hesitate to reach out if you have questions or need assistance.

Welcome aboard, and happy coding!

---

<a name="appendix"></a>
## 8. Appendix

### Example Code Repositories

- **Public Connectors**: Refer to existing connectors like Bitmart, MEXC, and Coinbase in our codebase for practical examples.
- **Private Connectors**: See implementations of Coinbase, Bitmart, and MEXC private connectors for reference.

### Utility Functions and Mappings

- **Symbol Mapping**: `getExchangeSymbol`, `getSklSymbol`
- **Side Mapping**: `sideMap`, `invertedSideMap`, `MexcSideMap`, `MexcInvertedSideMap`
- **Order Type Mapping**: `orderTypeMap`, `MexcOrderTypeMap`

### Common Serializable Types

- **Trade**
- **TopOfBook**
- **Ticker**
- **OrderStatusUpdate**
- **BalanceResponse**

---

**Note**: This guide is intended for internal use within our development team. Please keep all proprietary code and information confidential.

---

# End of Guide

Feel free to reach out if you have any questions or need further assistance. No question is a stupid question!
