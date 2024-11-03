import { Logger } from '../../util/logging'
import { getSklSymbol } from '../../util/config'
import {
	BalanceRequest,
	BalanceResponse,
	BatchOrdersRequest,
	CancelOrdersRequest,
	ConnectorConfiguration,
	ConnectorGroup,
	Credential,
	OpenOrdersRequest,
	OrderState,
	OrderStatusUpdate,
	PrivateExchangeConnector,
	Serializable,
	Side,
	SklEvent,
} from '../../types'
import {
	CONNECTOR_TYPE,
	getBtcTurkSymbol,
	OrderSideMap,
	TradeSideMapToSKL,
	OnMessage,
	OrderTypeMap,
	OrderStatusMapToSKL,
	OrderSideMapToSKL,
	OrderUpdateStateMap
} from '../../btcturk-spot'
import BtcTurkRestClient from '../../lib/BtcTurkRestClient'
import BtcTurkWSPrivateClient, { BtcTurkWSPrivateEvent } from '../../lib/BtcTurkWSPrivateClient'
import {
	BtcTurkResultGeneric,
	BtcTurkSubmitOrderMethod,
	BtcTurkOrder,
	BtcTurkSubmitOrderParams,
	BtcTurkSubmitOrderResult,
	BtcTurkOrderUpdate,
} from '../../lib/types'
const logger = Logger.getInstance('btcturk-spot-private-connector')

export class BtcTurkSpotPrivateConnector implements PrivateExchangeConnector {
	public btcTurkRestClient: BtcTurkRestClient
	public btcTurkWSClient: BtcTurkWSPrivateClient
	public debug = false
	private exchangeSymbol: string
	private sklSymbol: string
	public socketUrl: string
	// public amountPrecision = 0
	// public pricePrecision = 0
	// private tokenRefreshInterval = 1000 * 60 * 1.5
	// private pingInterval: any

	constructor(
		private group: ConnectorGroup,
		private config: ConnectorConfiguration,
		private credential: Credential,
	) {
		this.exchangeSymbol = getBtcTurkSymbol(this.group, this.config)
		this.sklSymbol = getSklSymbol(this.group, this.config)
		this.btcTurkWSClient = new BtcTurkWSPrivateClient(
			this.credential.key,
			this.credential.secret,
			3000,
			logger
		)
		this.btcTurkRestClient = new BtcTurkRestClient(
			this.credential.key,
			this.credential.secret
		)
		this.socketUrl = this.btcTurkWSClient.socketUrl
	}

	public connect = async (onMessage: OnMessage): Promise<void> => this
		.btcTurkWSClient
		.connect(e => this.debug && logger.log('DEBUG: message received', e.data))
		.then(async connected => {
			if (!connected) return

			const ok = !this.credential
				|| await (this.btcTurkWSClient as BtcTurkWSPrivateClient).login()
			// BtcTurkWSClient will auto re-subscribe on auto-reconnect

			ok && await this.subscribeToPrivateChannels(onMessage)
		})

	private createOrderStatusUpdate = (order: BtcTurkOrderUpdate): OrderStatusUpdate => {
		const wsEventType = order.type
		const state: OrderState = OrderUpdateStateMap[wsEventType]
		const side: Side = TradeSideMapToSKL[order.orderType]
		const price = parseFloat(order.price)
		const filledSize = parseFloat(order.amount) - parseFloat(order.numLeft)
		const remainingSize = parseFloat(order.numLeft)
		const size = filledSize + remainingSize
		const notional = price * size
		return {
			symbol: this.sklSymbol,
			connectorType: 'Coinbase',
			event: 'OrderStatusUpdate',
			state,
			orderId: order.id,
			sklOrderId: order.newOrderClientId,
			side,
			price,
			size,
			notional,
			filled_price: price,
			filled_size: filledSize,
			timestamp: Date.now(),
		}
	}

	/**
	 * @name	deleteAllOrders
	 * @summary delete all open orders
	 * 
	 * @returns {Promise<BtcTurkResultGeneric[]>} results array
	 */
	public deleteAllOrders = async (request: CancelOrdersRequest): Promise<any> => {
		const {
			data: {
				asks = [],
				bids = [],
			},
		} = await this
			.btcTurkRestClient
			.order
			.getOpenOrders(this.exchangeSymbol)
		const promises = [...asks, ...bids]
			.map((order) => this
				.btcTurkRestClient
				.order
				.delete(order.id)
			)
		return await Promise.all(promises)
	}

	public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
		const { data: assets } = await this.btcTurkRestClient.getAccountBalance()

		const baseAsset = this.group.name
		const quoteAsset = this.config.quoteAsset
		const base = assets
			.find(a => [a.asset, a.assetname].includes(baseAsset))
			|| { free: '0', locked: '0' }


		const quote = assets.find(a => [a.asset, a.assetname].includes(quoteAsset))
			|| { free: '0', locked: '0' }

		const baseBalance = parseFloat(base.free) + parseFloat(base.locked)
		const quoteBalance = parseFloat(quote.free) + parseFloat(quote.locked)

		const baseValue = baseBalance * request.lastPrice
		const totalValue = baseValue + quoteBalance
		const inventoryPercentage = (baseValue / totalValue) * 100

		return {
			event: 'BalanceResponse',
			symbol: this.sklSymbol,
			baseBalance,
			quoteBalance,
			inventory: inventoryPercentage,
			timestamp: Date.now(),
		}
	}

	public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
		const {
			data: {
				asks = [],
				bids = [],
			},
		} = await this
			.btcTurkRestClient
			.order
			.getOpenOrders(this.exchangeSymbol)

		return [...asks, ...bids].map(o => ({
			event: 'OrderStatusUpdate',
			connectorType: CONNECTOR_TYPE,
			symbol: this.sklSymbol,
			orderId: o.id,
			sklOrderId: o.newOrderClientId,
			state: OrderStatusMapToSKL[o.status],
			side: OrderSideMapToSKL[o.type],
			price: parseFloat(o.price),
			size: parseFloat(o.quantity),
			notional: parseFloat(o.price) * parseFloat(o.quantity),
			filled_price: parseFloat(o.price),
			filled_size: parseFloat(o.quantity) - parseFloat(o.leftAmount),
			timestamp: o.time,
		}))
	}

	/**
	 * @name	placeOrders
	 * @summary create new orders
	 */
	public placeOrders = async (request: BatchOrdersRequest): Promise<BtcTurkSubmitOrderResult[]> => {
		const orders = request.orders.map(order => {
			const orderMethod = OrderTypeMap[order.type] || null
			if (!orderMethod) return Promise.reject(`Order type ${order.type} is not supported by BtcTurk`)

			const params: BtcTurkSubmitOrderParams = {
				orderMethod,
				newOrderClientId: `skl-order-${new Date().getTime()}`,
				orderType: OrderSideMap[order.side],
				pairSymbol: this.exchangeSymbol,
				price: Number(order.price.toFixed(8)),
				quantity: Number(order.size.toFixed(8)),
				// stopPrice: //for stop-limit and stop-market orders
			}
			return this.btcTurkRestClient.order.create(params)
		})

		return await Promise.all(orders)
	}

	public stop = async () => {
		await this.btcTurkWSClient.unsubscribeAll()
		await this.deleteAllOrders({
			symbol: this.sklSymbol,
			event: 'CancelOrdersRequest',
			timestamp: Date.now(),
			connectorType: CONNECTOR_TYPE,
		})
		this.btcTurkWSClient.stop()
	}

	private subscribeToPrivateChannels = (onMessage: OnMessage): void => {
		const params = this.btcTurkWSClient.getSubscribeParam(
			BtcTurkWSPrivateEvent.OrderUpdate,
			(result: BtcTurkOrderUpdate) => onMessage([this.createOrderStatusUpdate(result)])
		)
		this.btcTurkWSClient.subscribeBatch([params])
	}
}
export default BtcTurkSpotPrivateConnector