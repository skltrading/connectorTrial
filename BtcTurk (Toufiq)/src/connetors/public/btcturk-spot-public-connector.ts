import {
    ConnectorConfiguration, // { quoteAsset: string }
    ConnectorGroup, // { name: string }
    Credential, // { key: string, secret: string }
    PublicExchangeConnector,
    Serializable,
    SklEvent,
    Ticker,
    TopOfBook,
    Trade,
} from '../../types'
import { getSklSymbol } from '../../util/config'
import { Logger } from '../../util/logging'
import {
    CONNECTOR_TYPE,
    getBtcTurkSymbol,
    TradeSideMapToSKL,
    OnMessage
} from '../../btcturk-spot'
import BtcTurkWSClient from '../../lib/BtcTurkWSClient'
import {
    BtcTurkOrderBookItem,
    BtcTurkOrderBookResult,
    BtcTurkTicker,
    BtcTurkTickerResult,
    BtcTurkTradeListItem,
    BtcTurkTradeSingle
} from '../../lib/types'
import { BtcTurk_WS_TYPE } from '../../lib/utils'

const logger = Logger.getInstance('btcturk-spot-public-connector')

export class BtcTurkSpotPublicConnector implements PublicExchangeConnector {
    public asks: BtcTurkOrderBookItem[] = []
    public bids: BtcTurkOrderBookItem[] = []
    private btcTurkWSClient: BtcTurkWSClient
    public debug = false
    private exchangeSymbol: string
    private sklSymbol: string
    public socketUrl: string

    constructor(
        private group: ConnectorGroup,
        private config: ConnectorConfiguration,
        // currently BtcTurk public connection does not require any authentication.
        // therefore, "credential" is unused. but the variable is kept to keep the class implementation consistent.
        private credential?: Credential,
    ) {
        this.btcTurkWSClient = new BtcTurkWSClient(3000, logger)
        this.socketUrl = this.btcTurkWSClient.socketUrl
        this.exchangeSymbol = getBtcTurkSymbol(this.group, this.config)
        this.sklSymbol = getSklSymbol(this.group, this.config)
    }

    public connect = async (onMessage: OnMessage): Promise<void> => this.btcTurkWSClient
        .connect(e => this.debug && logger.log('DEBUG: message received', e.data))
        .then(async (connected: Boolean) => {
            if (!connected) return

            // BtcTurkWSClient will auto re-subscribe on auto-reconnect
            this.subscribeToChannels(onMessage)
        })

    //  not necessary as it is already handled by the subscribeToChannels()
    // private createSerializableEvents(eventType: SklEvent, message: any): Serializable[] {
    //     return []
    // }

    private createTicker = (ticker: BtcTurkTicker): Ticker => ({
        symbol: this.sklSymbol,
        connectorType: CONNECTOR_TYPE,
        event: 'Ticker',
        lastPrice: parseFloat(ticker.LA),
        timestamp: new Date().getTime(), // No timestamp supplied by the API. Using current time
    })

    private createTopOfBook = (orderbook: BtcTurkOrderBookResult, group: ConnectorGroup): TopOfBook => ({
        symbol: this.sklSymbol,
        connectorType: CONNECTOR_TYPE,
        event: 'TopOfBook',
        timestamp: new Date().getTime(), // No timestamp supplied by the API. Using current time
        askPrice: parseFloat(orderbook.AO[0].P),
        askSize: parseFloat(orderbook.AO[0].A),
        bidPrice: parseFloat(orderbook.BO[0].P),
        bidSize: parseFloat(orderbook.BO[0].A),
    })

    private createTrade = (trade: BtcTurkTradeListItem): Trade => ({
        symbol: this.sklSymbol,
        connectorType: CONNECTOR_TYPE,
        event: 'Trade',
        price: parseFloat(trade.P),
        size: parseFloat(trade.A),
        side: TradeSideMapToSKL[trade.S],
        timestamp: new Date(trade.D).getTime(),
    })

    //  not necessary as it is already handled by the subscribeToChannels()
    // private getEventType(message: any): SklEvent | null {
    // }

    /**
     * @name    stop
     * @summary cancel all subscriptions connection
     */
    public stop = () => {
        this.btcTurkWSClient.unsubscribeAll()
        this.btcTurkWSClient.stop()
    }

    private subscribeToChannels(onMessage: OnMessage): void {
        this.btcTurkWSClient.subscribeBatch([
            {
                channel: 'trade',
                event: this.exchangeSymbol, // eg: "BTCUSDT"
                type: BtcTurk_WS_TYPE.TradeSingle,
                onResult: (trade: BtcTurkTradeSingle) => {
                    const serializableMessages: Serializable[] = [this.createTrade(trade)]
                    onMessage(serializableMessages)
                }
            },
            {
                channel: 'ticker',
                event: this.exchangeSymbol, // eg: "BTCUSDT"
                type: BtcTurk_WS_TYPE.TickerPair,
                onResult: (ticker: BtcTurkTickerResult) => {
                    const serializableMessages: Serializable[] = [this.createTicker(ticker)]
                    onMessage(serializableMessages)
                }
            },
            {
                channel: 'orderbook',
                event: this.exchangeSymbol, // eg: "BTCUSDT"
                type: BtcTurk_WS_TYPE.OrderBookFull,
                onResult: (orderbook: BtcTurkOrderBookResult) => {
                    this.asks = orderbook.AO
                    this.bids = orderbook.BO
                    const serializableMessages: Serializable[] = [this.createTopOfBook(orderbook, this.group)]
                    onMessage(serializableMessages)
                }
            }
        ])
    }
}
export default BtcTurkSpotPublicConnector