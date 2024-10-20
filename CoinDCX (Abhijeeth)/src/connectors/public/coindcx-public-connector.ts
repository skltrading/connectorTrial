import { connect, io, Socket } from 'socket.io-client';
import crypto from 'crypto';
import { Logger } from "../../utils/logging";
import { ConnectorConfiguration, ConnectorGroup, PublicExchangeConnector, Serializable, PriceChange, DepthUpdate, TradeUpdate, Candlestick } from "../../types";

const logger = Logger.getInstance('coinDCX-public-connector');

export class CoinDCXPublicConnector implements PublicExchangeConnector {
    public socket: any;
    private readonly socketEndpoint = 'wss://stream.coindcx.com';
    private exchangeSymbol: string;

    constructor(private group: ConnectorGroup, private config: ConnectorConfiguration) {
        this.exchangeSymbol = `${this.group.name}${this.config.quoteAsset}`;
    }

    public async connect(onMessage: (m: Serializable[]) => void): Promise<void> {
        logger.log(`Attempting to connect to CoinDCX`);

        this.socket = io(this.socketEndpoint, {
            transports: ['websocket']
        });

        this.socket.on("connect", () => {
            logger.log('Connected to WebSocket.');
            this.subscribeToAllChannels();

        });

        this.socket.on("price-change", (response: any) => {
            logger.log(`Event Fired - Received Price Change: ${JSON.stringify(response)}`);
            const parsedData = JSON.parse(response.data);
            const data = this.createPriceChange(parsedData);
            if (data) logger.log(`Processed Data: ${JSON.stringify(data)}`);
            onMessage([data]);

            console.log("It worked 1");
        });

        
        this.socket.on("depth-update", (response: any) => {
            console.log(`Depth Update Response: ${response}`);
            const parsedData = JSON.parse(response.data);
            const data = this.createDepthUpdate(parsedData);
            logger.log(`Received Depth Update: ${JSON.stringify(data)}`);
            onMessage([data]);

            console.log("It worked 2",response);
        });
        
        this.socket.on("trade-update", (response: any) => {
            const parsedData = JSON.parse(response.data);
            const data = this.createTradeUpdate(parsedData);
            logger.log(`Received Trade Update: ${JSON.stringify(data)}`);
            onMessage([data]);

            console.log("It worked 13");

        });
        
        this.socket.on("candlestick", (response: any) => {
            const parsedData = JSON.parse(response.data);
            const data = this.createCandlestick(parsedData);
            logger.log(`Received Candlestick: ${JSON.stringify(data)}`);
            onMessage([data]);

            console.log("It worked 14");

        });

        this.socket.on("disconnect", () => {
            logger.warn('WebSocket disconnected');
        });
        
    }

    public subscribeToAllChannels() {
        if (this.socket) {
            this.socket.emit('join', {
                'channelName': `B-${this.exchangeSymbol}@prices`
            });

            this.socket.emit('join', {
                'channelName': `B-${this.exchangeSymbol}@orderbook@20`
            });

            this.socket.emit('join', {
                'channelName': `B-${this.exchangeSymbol}@trades`
            });

            this.socket.emit('join', {
                'channelName': `B-${this.exchangeSymbol}_1m`
            });

            logger.log('Subscribed to all relevant channels.');
        }
    }

    public unsubscribeFromAllChannels() {
        if (this.socket) {
            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@prices`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@orderbook@20`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@trades`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}_1m`
            });

            logger.log('Unsubscribed from all relevant channels.');
        }
    }

    public async stop(): Promise<void> {
        if (this.socket) {
            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@prices`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@orderbook@20`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}@trades`
            });

            this.socket.emit('leave', {
                'channelName': `B-${this.exchangeSymbol}_1m`
            });

            this.socket.disconnect();
            logger.log('Disconnected from WebSocket.');
        }
    }

    private createPriceChange(data: any): PriceChange {
        return {
            symbol: this.exchangeSymbol,
            event: 'PriceChange',
            price: parseFloat(data.p),
            timestamp: data.T,
            connectorType: this.config.connectorType
        };
    }
    
    private createDepthUpdate(data: any): DepthUpdate {
        return {
            symbol: this.exchangeSymbol,
            event: 'DepthUpdate',
            asks: data.asks.map((ask: any) => ({ price: parseFloat(ask[0]), quantity: parseFloat(ask[1]) })),
            bids: data.bids.map((bid: any) => ({ price: parseFloat(bid[0]), quantity: parseFloat(bid[1]) })),
            timestamp: data.ts,
            connectorType: this.config.connectorType
        };
    }
    
    private createTradeUpdate(data: any): TradeUpdate {
        return {
            symbol: this.exchangeSymbol,
            event: 'TradeUpdate',
            price: parseFloat(data.p),
            quantity: parseFloat(data.q),
            side: data.m ? 'Buy' : 'Sell',
            timestamp: data.T,
            connectorType: this.config.connectorType
        };
    }
    
    private createCandlestick(data: any): Candlestick {
        return {
            symbol: this.exchangeSymbol,
            event: 'Candlestick',
            open: parseFloat(data.o),
            close: parseFloat(data.c),
            high: parseFloat(data.h),
            low: parseFloat(data.l),
            volume: parseFloat(data.v),
            timestamp: data.t,
            connectorType: this.config.connectorType
        };
    }
    
    
}
