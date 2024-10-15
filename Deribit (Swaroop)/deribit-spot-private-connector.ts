import * as Types from "./types"
import { WebSocket } from 'ws'
import { HmacSHA256 } from 'crypto-js';
import { directionMap, MAX_RETRY_COUNT } from './deribit-spot';
import { configDotenv } from "dotenv";

configDotenv()

export class DeribitSpotPrivateConnector {
    public publicWebsocketAddress = 'wss://www.deribit.com/ws/api/v2';

    public retryCount = 0;
    public websocket: WebSocket;

    public bids: Types.Spread[] = []
    public asks: Types.Spread[] = []

    public async connect(onMessage: (m: Types.Serializable[]) => void): Promise<void> {
        try {
            console.log(`Attempting to connect to Deribit`);

            const url = this.publicWebsocketAddress;
            this.websocket = new WebSocket(url);

            this.websocket.on('open', () => {
                try {
                    this.auth()
                    setTimeout(() => {
                        // Hardcoding values for now but this can be obtained via props
                        this.subscribeToChannels({exchangeSymbol: "ETH-PERPETUAL", group: "1", interval: "100ms", orderBookDepth: 1})
                    }, 1000)
                    this.retryCount = 0;
                } catch (err) {
                    console.error(`Error while connecting to WebSocket: ${err.message}`);
                }
            });

            this.websocket.on('message', (message: Buffer) => {
                try {
                    const data = message.toString();
                    this.handleMessage(data, onMessage)
                } catch (err) {
                    console.error(`Error processing WebSocket message: ${err.message}`);
                }
            });

            this.websocket.on('error', (err: any) => {
                console.error(`WebSocket error: ${err.message || err.toString()}`);

                const timer = setTimeout(() => {
                    if (this.retryCount < MAX_RETRY_COUNT) {
                        this.retryCount += 1;
                        console.log(`Reconnecting attempt ${this.retryCount} to WebSocket...`);
            
                        // Clear previous socket and try reconnecting
                        this.logout()
                        this.websocket.terminate(); // Close existing socket if necessary
                        this.connect(onMessage).catch((connectionErr) => {
                            console.error('Reconnection failed:', connectionErr);
                        });
            
                    } else {
                        clearTimeout(timer);
                        console.error("Max retries reached. Unable to reconnect.");
                    }
                }, 1000); // Retry after 1 second
            });

            this.websocket.on('close', (code, reason) => {
                console.log(`WebSocket closed: ${[code, reason].join(' - ')}`);
            });
    
        } catch (error) {
            console.error(`Error during WebSocket connection setup: ${error.message}`);
        }
    }

    public async getVersion() {
        const message = JSON.stringify({
            'id': 'VERSION',
            'method': '/public/test',
        });
        this.websocket.send(message);
    }
    
    public async unsubscribeToAllChannels() {
        const message = JSON.stringify({
            'id': 'UNSUBSCRIBE',
            'method': '/private/unsubscribe_all',
        });
        this.websocket.send(message);
    }

    public async stop() {
        this.logout()
        this.unsubscribeToAllChannels()
        this.websocket.close();
    }

    public async destroy() {
        this.websocket.terminate();
    }

    private subscribeToChannels({ exchangeSymbol, group, orderBookDepth, interval }: { exchangeSymbol: string, group: Types.ConnectorGroup,  orderBookDepth: Types.OrderBookDepth, interval: Types.PrivateInterval }): void {
        const channels = [
            `trades.${exchangeSymbol}.${interval}`,
            `book.${exchangeSymbol}.${group}.${orderBookDepth}.${interval}`,
            `ticker.${exchangeSymbol}.${interval}`,
        ];
    
        const subscriptionMessage = {
            method: 'private/subscribe',
            params: { channels },
        };
    
        this.websocket.send(JSON.stringify(subscriptionMessage));
    }

    private getEventType(message: Types.DeribitEventData): Types.SklEvent | null {
        if ("params" in message  && "id" in message) {
            return message.params.id
        } 
        else if ("params" in message && "channel" in message.params) {
            if (message.params.channel.startsWith("trades")) return "Trade"
            else if (message.params.channel.startsWith("book")) return "TopOfBook"
            else if (message.params.channel.startsWith("ticker")) return "Ticker"
        }
        else if ("error" in message) {
            console.error(`Error while requesting data: ${JSON.stringify(message.error)}`);
            return null
        }
        return null
    }

    private handleMessage(data: string, onMessage: (messages: Types.Serializable[]) => void): void {
        const message = JSON.parse(data) as Types.DeribitEventData;
        const eventType = this.getEventType(message);
    
        if (eventType) {
            const serializableMessages = this.createSerializableEvents(eventType, message);
            if (serializableMessages.length > 0) {
                onMessage(serializableMessages);
            }
        } else {
            console.log(`No handler for message: ${JSON.stringify(data)}`);
        }
    }

    private createSerializableEvents(eventType: Types.SklEvent, eventData: Types.DeribitEventData): Types.Serializable[] {
        switch (eventType) {
            case 'Trade': {
                const trades = eventData.params.data as unknown as Types.DeribitTrade[]
                return trades.map((trade: Types.DeribitTrade) => this.createTrade(trade)).filter((trade) => trade !== null)
            }
            case 'TopOfBook': {
                const topOfBook = eventData.params.data as unknown as Types.DeribitTopOfBook
                this.updateBook(topOfBook)
                return [this.createTopOfBook(topOfBook)].filter((e) => e !== null);
            }
            case 'Ticker': {
                const ticker = eventData.params.data as unknown as Types.DeribitTicker
                return [this.createTicker(ticker)].filter((e) => e !== null);
            }
            default:
                return [];
        }
    }

    private createTicker(ticker: Types.DeribitTicker): Types.SklTicker {
        return {
            event: 'Ticker',
            connectorType: 'Deribit',
            symbol: ticker.instrument_name,
            lastPrice: ticker.last_price,
            timestamp: (new Date(ticker.timestamp)).getTime(),
        };
    }

    private createTrade(trade: Types.DeribitTrade): Types.SklTrade | null {
        const tradeSide: string | undefined = trade.direction
        if (tradeSide) {
            return {
                event: 'Trade',
                connectorType: 'Deribit',
                symbol: trade.instrument_name,
                price: trade.price,
                size: trade.mark_price,
                side: directionMap[tradeSide],
                timestamp: (new Date(trade.timestamp)).getTime(),
            }
        } else {
            return null
        }
    }

    private createTopOfBook(topOfBook: Types.DeribitTopOfBook): Types.SklTopOfBook | null {
        if (topOfBook.asks.length === 0 || topOfBook.bids.length === 0) {
            return null
        }
        return {
            event: 'TopOfBook',
            connectorType: 'Deribit',
            symbol: topOfBook.instrument_name,
            askPrice: topOfBook?.asks?.[0]?.[1],
            askSize: topOfBook?.asks?.[0]?.[2],
            bidPrice: topOfBook?.bids?.[0]?.[1],
            bidSize: topOfBook?.bids?.[0]?.[2],
            timestamp: (new Date(topOfBook.timestamp)).getTime(),
        };
    }

    private updateBook(data: Types.DeribitTopOfBook) {
        const self = this
        const bidsList = data.bids
        const asksList = data.asks

        // initial snapshot of orderbook
        if (data.type === "snapshot") {
            self.bids = bidsList
            self.asks = asksList
            // changes on orderbook
        } else if (data.type === "change") {
            // update bids
            bidsList.forEach((event: [string, number, number]) => {
                const eventIndex = self.bids.findIndex(bid => bid?.[1] === event?.[1])
                // remove existing bid if no more quantity/amount
                if (event?.[2] === 0 && eventIndex !== -1) {
                    self.bids.splice(eventIndex, 1)
                    // add bid with quantity if not already in array - sorted descending
                } else if (event?.[2] > 0 && eventIndex === -1) {
                    self.bids.unshift(event)
                    self.bids.sort((a, b) => b?.[1] - a?.[1])
                }
            })

            // updates asks
            asksList.forEach((event: [string, number, number]) => {
                const eventIndex = self.asks.findIndex(ask => ask?.[1] === event?.[1])
                // remove existing ask if no more quantity/amount
                if (event?.[2]  === 0 && eventIndex !== -1) {
                    self.asks.splice(eventIndex, 1)
                    // add ask with quantity if not already in array - sorted ascending
                } else if (event?.[2] > 0 && eventIndex === -1) {
                    self.asks.unshift(event)
                    self.asks.sort((a, b) => a?.[1] - b?.[1])
                }

            })
        }
    }

    private logout() {
        const message = JSON.stringify({
            method : "private/logout",
        });
        this.websocket.send(message);
    }

    private auth() {
        const clientId = process.env.CLIENT_ID
        const clientSecret = process.env.CLIENT_SECRET
        const timestamp = Date.now()
        const nonce = "xyz"
        const data = ""

        const signature = HmacSHA256(`${timestamp}\n${nonce}\n${data}`, clientSecret).toString();

        const message = JSON.stringify({
            method : "public/auth",
            params : {
                "grant_type" : "client_signature",
                "client_id" : clientId,
                "timestamp": timestamp,
                "signature": signature,
                "nonce": nonce,
            }
        });
        this.websocket.send(message);
    }
}