import { Serializable } from 'worker_threads';
import { WebSocket } from 'ws'
import { directionMap } from './deribit-spot';

const MAX_RETRY_COUNT = 2
export class DeribitSpotPublicConnector {
    public publicWebsocketAddress = 'wss://www.deribit.com/ws/api/v2';

    public retryCount = 0;
    public websocket: WebSocket;

    public bids: [string, number, number][] = []
    public asks: [string, number, number][] = []

    public async connect(onMessage: (m: any[]) => void, socket = null): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                console.log(`Attempting to connect to Deribit`);
    
                const url = this.publicWebsocketAddress;
                this.websocket = socket || new WebSocket(url);
    
                this.websocket.on('open', () => {
                    try {
                        // this.subscribeToChannels()
                        this.retryCount = 0;
                        resolve(true); 
                    } catch (err) {
                        console.error(`Error while connecting to WebSocket: ${err.message}`);
                        reject(err); 
                    }
                });
    
                this.websocket.on('message', (message) => {
                    try {
                        const eventType: SklEvent | null = this.getEventType(message)

                        const data = JSON.parse(message);
                        console.log(`No handler for message: ${JSON.stringify(data)}`);
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
                            this.websocket.terminate(); // Close existing socket if necessary
                            this.connect(onMessage).catch((connectionErr) => {
                                console.error('Reconnection failed:', connectionErr);
                                reject(connectionErr); // Only reject on actual reconnection failure
                            });
                
                        } else {
                            clearTimeout(timer);
                            console.error("Max retries reached. Unable to reconnect.");
                            // Reject with a meaningful error
                            reject(new Error("Max retrial reached for connection establishment")); 
                        }
                    }, 1000); // Retry after 1 second
                });
    
                this.websocket.on('close', (code, reason) => {
                    console.log(`WebSocket closed: ${[code, reason].join(' - ')}`);
                });
        
            } catch (error) {
                console.error(`Error during WebSocket connection setup: ${error.message}`);
                reject(error); 
            }
        });
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
            'method': '/public/unsubscribe_all',
        });
        this.websocket.send(message);
    }

    public async stop() {
        this.unsubscribeToAllChannels()
        this.websocket.close();
    }

    public async destroy() {
        this.websocket.terminate();
    }

    private subscribeToChannels({ exchangeSymbol, group, orderBookDepth, interval }: { exchangeSymbol: string, group: ConnectorGroup,  orderBookDepth: OrderBookDepth, interval: PublicInterval }): void {
        const channels = [
            `trades.${exchangeSymbol}.${interval}`,
            `book.${exchangeSymbol}.${group}.${orderBookDepth}.${interval}`,
            `ticker.${exchangeSymbol}.${interval}`,
        ];
    
        const subscriptionMessage = {
            method: 'public/subscribe',
            params: { channels },
        };
    
        this.websocket.send(JSON.stringify(subscriptionMessage));
    }

    // To determine subscribed events
    private getEventType(message): SklEvent | null {
        if ("id" in message) {
            return message.id
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

    private handleMessage(data: string, onMessage: (messages: Serializable[]) => void): void {
        const message = JSON.parse(data) as DeribitEventData;
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

    private createSerializableEvents(eventType: SklEvent, eventData: DeribitEventData): Serializable[] {
        switch (eventType) {
            case 'Trade': {
                const trades = eventData.params.data as unknown as DeribitTrade[]
                return trades.map((trade: DeribitTrade) => this.createTrade(trade)).filter((trade) => trade !== null)
            }
            case 'TopOfBook': {
                const topOfBook = eventData.params.data as unknown as DeribitTopOfBook
                this.updateBook(topOfBook)
                return [this.createTopOfBook(topOfBook)].filter((e) => e !== null);
            }
            case 'Ticker': {
                const ticker = eventData.params.data as unknown as DeribitTicker
                return [this.createTicker(ticker)].filter((e) => e !== null);
            }
            default:
                return [];
        }
    }

    private createTicker(ticker: DeribitTicker): SklTicker {
        return {
            event: 'Ticker',
            connectorType: 'Deribit',
            symbol: ticker.instrument_name,
            lastPrice: ticker.last_price,
            timestamp: (new Date(ticker.timestamp)).getTime(),
        };
    }

    private createTrade(trade: DeribitTrade): SklTrade | null {
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

    private createTopOfBook(topOfBook: DeribitTopOfBook): SklTopOfBook | null {
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

    private updateBook(data: DeribitTopOfBook) {
        const self = this
        const bidsList = data.bids
        const asksList = data.asks

        // initial orderbook
        if (data.type === "snapshot") {
            self.bids = bidsList
            self.asks = asksList
            // updates for orderbook
        } else if (data.type === "change") {
            // updates for bids
            bidsList.forEach((event: [string, number, number]) => {
                const eventIndex = self.bids.findIndex(bid => bid?.[1] === event?.[1])
                // remove existing bid if no more quantity
                if (event?.[2] === 0 && eventIndex !== -1) {
                    self.bids.splice(eventIndex, 1)
                    // add bid with quantity if not already in array - sorted descending
                } else if (event?.[2] > 0 && eventIndex === -1) {
                    self.bids.unshift(event)
                    self.bids.sort((a, b) => b?.[1] - a?.[1])
                }
            })

            // updates for asks
            asksList.forEach((event: [string, number, number]) => {
                const eventIndex = self.asks.findIndex(ask => ask?.[1] === event?.[1])
                // remove existing ask
                if (event?.[2]  === 0 && eventIndex !== -1) {
                    self.asks.splice(eventIndex, 1)
                    // add ask with quantity if not already in array - sorted ascending
                } else if (event?.[2] > 0 && eventIndex === -1) {
                    self.asks.unshift(event)
                    self.asks.sort((a, b) => b?.[1] - a?.[1])
                }

            })
        }
    }
}