import axios from 'axios';
import { WebSocket } from 'ws';
import CryptoJS from 'crypto-js';
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
} from '../../types';
import {
  getCoinbaseSymbol,
  sideMap
} from './coinbase-spot';
import { Logger } from '../../util/logging';
import { getSklSymbol } from '../../util/config';
import * as jwt from 'jsonwebtoken';
import * as crypto from 'crypto';
const logger = Logger.getInstance('coinbase-spot-private-connector')

interface CoinbaseEvent {
  channel: string,
  timestamp: string,
  sequence_num: number,
  events: CoinbaseHeartbeatEvent[] | CoinbaseOpenOrderResponse[] | CoinbaseOrderStatusEvent[],
}

interface CoinbaseHeartbeatEvent {
  current_time: string,
  heartbeat_counter: string,
}

interface CoinbasePlaceOrderRequest {
  client_order_id: string,
  product_id: string,
  side: string,
  order_configuration: {
    limit_limit_gtc: {
      post_only: boolean
      base_size: string,
      limit_price: string,
    }
  }
}

interface CoinbasePlaceOrderResponse {
  success: boolean,
  failure_reason: string,
  order_id: string,
  success_response: {
    order_id: string,
    product_id: string,
    side: string,
    client_order_id: string,
  },
  error_response: {
    error: string,
    messag: string,
    error_details: string,
    preview_failure_reason: string,
    new_order_failure_reason: string,
  },
}

interface CoinbaseOpenOrderResponse {
  type: string;
  orders: CoinbaseOpenOrder[];
}

interface CoinbaseOrderStatusEvent {
  orders: CoinbaseOrderStatus[];
  sequence: string;
  has_next: boolean;
  cursor: string;
}

interface CoinbaseOrderStatus {
  order_id: string,
  client_order_id: string,
  cumulative_quantity: string,
  leaves_quantity: string,
  avg_price: string,
  total_fees: string,
  status: string,
  product_id: string,
  creation_time: string,
  order_side: string,
  order_type: string,
  cancel_reason: string,
  reject_Reason: string,
}

interface CoinbaseOpenOrder {
  order_id: string;
  product_id: string;
  user_id: string;
  side: string;
  client_order_id: string;
  status: string;
  time_in_force: string;
  created_time: string;
  filled_size: string;
  average_filled_price: string;
  fee: string;
  number_of_fills: string;
  filled_value: string;
  total_fees: string;
  order_configuration: {
    limit_limit_gtc: {
      post_only: boolean;
      end_time: string;
      base_size: string;
      limit_price: string;
    }
  }
}

const websocketOrderUpdateStateMap: { [key: string]: OrderState } = {
  'OPEN': 'Placed',
  'FILLED': 'Filled',
  'CANCELLED': 'Cancelled',
  'EXPIRED': 'Cancelled',
  'FAILED': 'Cancelled',
}

type CoinbaseSide = 'BUY' | 'SELL'
const invertedSideMap: { [key: string]: CoinbaseSide } = {
  'Buy': 'BUY',
  'Sell': 'SELL'
}

const getEventType = (message: CoinbaseEvent): SklEvent | null => {
  if (message.channel === 'user') {
    return 'OrderStatusUpdate'
  }
  return null
}

export class CoinbaseSpotPrivateConnector
  implements PrivateExchangeConnector {
  public publicWebsocketAddress = 'wss://advanced-trade-ws.coinbase.com'
  public restUrl = 'https://api.coinbase.com'
  private route = '/api/v3/brokerage'
  public publicWebsocketFeed: any
  private coinbaseSymbol: string
  private sklSymbol: string
  public amountPrecision = 0;
  public pricePrecision = 0;
  private tokenRefreshInterval = 1000 * 60 * 1.5;
  private pingInterval: any

  constructor(
    private group: ConnectorGroup,
    private config: ConnectorConfiguration,
    private credential: Credential,
  ) {
    const self = this
    self.coinbaseSymbol = getCoinbaseSymbol(self.group, self.config)
    self.sklSymbol = getSklSymbol(self.group, self.config)
  }

  public async connect(onMessage: (m: Serializable[]) => void): Promise<any> {
    const self = this
    const publicFeed = new Promise(async (resolve) => {
      if (self.amountPrecision === 0 || self.pricePrecision === 0) {
        try {
          console.log('COINBASE: SETUP PRECISION DATA')
          const res = await self.getRequest(`/products/${self.coinbaseSymbol}`, {})
          self.amountPrecision = res.base_increment.split(".")[1].length
          self.pricePrecision = res.quote_increment.split(".")[1].length
        } catch (e) {
          console.log('COINBASE: FAILED TO RETRIEVE PRECISION')
        }

      }
      const url = self.publicWebsocketAddress;
      self.publicWebsocketFeed = new WebSocket(url);
      self.publicWebsocketFeed.on('open', () => {

        self.subscribeToProducts('heartbeats');

        self.subscribeToProducts('user');

        self.pingInterval = setInterval(() => {

          console.error(`Resubscribing to private channels: ${self.sklSymbol}`);

          self.subscribeToProducts('heartbeats');

          self.subscribeToProducts('user');

        }, this.tokenRefreshInterval);

        resolve(true);
      });

      self.publicWebsocketFeed.onmessage = (message: any) => {

        const coinbaseEvent: CoinbaseEvent = JSON.parse(message.data) as CoinbaseEvent
        logger.log(`Private websocket message: ${message.data}`)
        if (coinbaseEvent.channel === "heartbeats") {
          const heartbeats = coinbaseEvent.events as CoinbaseHeartbeatEvent[]
          heartbeats.map((event: CoinbaseHeartbeatEvent) => {
            logger.log(`Heartbeat: symbol = ${self.sklSymbol}, counter = ${event.heartbeat_counter}`);
          })
        } else {
          const actionType: SklEvent | null = getEventType(coinbaseEvent)
          if (actionType) {
            const serializableMessages: Serializable[] = self.createSklEvent(actionType, coinbaseEvent, self.group)
            onMessage(serializableMessages);
          } else {
            logger.log(`No handler for message: ${JSON.stringify(coinbaseEvent)}`)
          }
        }
      }

      self.publicWebsocketFeed.on('error', function error(err: any) {
        logger.log(`WebSocket error: ${err.toString()}`);
      });

      self.publicWebsocketFeed.on('close', (code, reason) => {
        const self = this
        logger.log(`WebSocket closed: ${code} - ${reason}`);
        setTimeout(() => {
          self.connect(onMessage)
        }, 1000);
      });
    })

    return await Promise.all([publicFeed]);
  }

  public async stop() {
    const self = this
    self.unsubscribeToProducts('heartbeats')
    self.unsubscribeToProducts('user')
    const cancelOrdersRequest: CancelOrdersRequest = {
      symbol: self.sklSymbol,
      event: 'CancelOrdersRequest',
      timestamp: Date.now(),
      connectorType: 'Coinbase'
    }
    return this.deleteAllOrders(cancelOrdersRequest)
  }

  private createOpenOrderResponse = (order: CoinbaseOpenOrder): OrderStatusUpdate => {
    const self = this
    const state: OrderState = websocketOrderUpdateStateMap[order.status]
    const side: Side = sideMap[order.side]
    const price = parseFloat(order.order_configuration.limit_limit_gtc.limit_price)
    const size = parseFloat(order.order_configuration.limit_limit_gtc.base_size)
    const notional = price * size
    return {
      symbol: self.sklSymbol,
      connectorType: 'Coinbase',
      event: 'OrderStatusUpdate',
      state,
      orderId: order.order_id,
      sklOrderId: order.client_order_id,
      side,
      price,
      size,
      notional,
      filled_price: parseFloat(order.average_filled_price),
      filled_size: parseFloat(order.filled_size),
      timestamp: Date.now(),
    }
  }

  private createOrderStatusUpdate = (order: CoinbaseOrderStatus): OrderStatusUpdate => {
    const self = this
    const state: OrderState = websocketOrderUpdateStateMap[order.status]
    const side: Side = sideMap[order.order_side]
    const price = parseFloat(order.avg_price)
    const filledSize = parseFloat(order.cumulative_quantity)
    const remainingSize = parseFloat(order.leaves_quantity)
    const size = filledSize + remainingSize
    const notional = price * size
    return {
      symbol: self.sklSymbol,
      connectorType: 'Coinbase',
      event: 'OrderStatusUpdate',
      state,
      orderId: order.order_id,
      sklOrderId: order.client_order_id,
      side,
      price,
      size,
      notional,
      filled_price: price,
      filled_size: filledSize,
      timestamp: Date.now(),
    }
  }

  private createSklEvent(event: SklEvent, message: CoinbaseEvent, group: ConnectorGroup): Serializable[] {
    const self = this
    if (event === 'OrderStatusUpdate') {
      const coinbaseOrderStatusEvent: CoinbaseOrderStatusEvent[] = message.events as CoinbaseOrderStatusEvent[]
      const sklOrders: OrderStatusUpdate[] = coinbaseOrderStatusEvent.flatMap((orderStatusEvent: CoinbaseOrderStatusEvent) => {
        const orders = orderStatusEvent.orders.map((order: CoinbaseOrderStatus) => {
          return self.createOrderStatusUpdate(order)
        })
        return orders
      })
      return sklOrders
    }
    else {
      logger.log(`Unhandled public connector event: ${event}`)
      return []
    }
  }

  public async getBalancePercentage(request: BalanceRequest): Promise<BalanceResponse> {
    const self = this
    const params = {}
    const endpoint = '/accounts'
    const walletBalancesRes = await self.getRequest(endpoint, params);
    const usdt = walletBalancesRes.accounts.find((account: any) => account.currency === self.config.quoteAsset);
    const base = walletBalancesRes.accounts.find((account: any) => account.currency === self.group.name);
    const baseValue = (parseFloat(base.available_balance.value) + parseFloat(base.hold.value)) * request.lastPrice;
    const usdtValue = (parseFloat(usdt.available_balance.value) + parseFloat(usdt.hold.value));
    const whole = baseValue + usdtValue;
    const pairPercentage = (baseValue / whole) * 100;
    return {
      event: 'BalanceResponse',
      symbol: self.sklSymbol,
      baseBalance: parseFloat(base.available_balance.value) + parseFloat(base.hold.value),
      quoteBalance: usdtValue,
      inventory: pairPercentage,
      timestamp: new Date().getTime(),
    }
  }

  public async getCurrentActiveOrders(request: OpenOrdersRequest): Promise<OrderStatusUpdate[]> {
    const self = this
    const params = {
      product_id: self.coinbaseSymbol,
      product_type: "SPOT",
      order_status: "OPEN"
    }
    const promise: Promise<OrderStatusUpdate[]> = self.getRequest("/orders/historical/batch", params)
      .then((res: CoinbaseOpenOrderResponse) => {
        logger.log(`Open orders: ${JSON.stringify(res)}`)
        const orders = res.orders.map((order: CoinbaseOpenOrder) => {
          return self.createOpenOrderResponse(order)
        })
        return orders
      })
    return promise
  }

  public async placeOrders(request: BatchOrdersRequest): Promise<any> {
    const self = this
    // USDC edge case: uses USDC instead of USD (for websocket)
    const quoteSymbol = self.config.quoteAsset === "USD" ? "USDC" : self.config.quoteAsset
    const fixedPair = `${self.group.name}-${quoteSymbol}`

    const orders = request.orders.map((o) => {
      const side = invertedSideMap[o.side]
      const amountDecimal = Math.pow(10, self.amountPrecision)
      const priceDecimal = Math.pow(10, self.pricePrecision)
      const amount = Math.floor(o.size * amountDecimal) / amountDecimal
      const price = Math.floor(o.price * priceDecimal) / priceDecimal;
      const timestamp = Date.now(); // Current timestamp in milliseconds
      const randomNumber = Math.floor(Math.random() * 1000000); // Random 6-digit number
      const orderId = `skl:${timestamp}_${randomNumber}`;
      const data: CoinbasePlaceOrderRequest = {
        client_order_id: orderId,
        product_id: fixedPair,
        side,
        order_configuration: {
          limit_limit_gtc: {
            post_only: true,
            base_size: amount.toString(),
            limit_price: price.toString()
          }
        }
      }
      return data
    })
    const responses: Promise<CoinbasePlaceOrderResponse>[] = orders.map(async (order) => {
      const res: Promise<CoinbasePlaceOrderResponse> = this.postRequest("/orders", order)
      return res
    })
    return Promise.all(responses)
  }

  public async deleteAllOrders(request: CancelOrdersRequest): Promise<void> {
    const self = this
    const payload: OpenOrdersRequest = {
      symbol: self.sklSymbol,
      event: 'OpenOrdersRequest',
      timestamp: Date.now(),
      connectorType: 'Coinbase'
    };

    const orders = await self.getCurrentActiveOrders(payload)
    const orderIds = orders.map(order => order.orderId)
    const data = {
      order_ids: orderIds
    }
    await self.postRequest("/orders/batch_cancel", data)
  }

  private sign(str, secret) {
    const hash = CryptoJS.HmacSHA256(str, secret);
    return hash.toString();
  }

  private timestampAndSign(message: any, channel: string, products: string[] = []) {
    const self = this
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const strToSign = `${timestamp}${channel}${products.join(',')}`;
    const sig = self.sign(strToSign, self.credential.secret);
    return { ...message, signature: sig, timestamp: timestamp };
  }

  private subscribeToProducts(channelName: string) {
    const self = this
    const products = [self.coinbaseSymbol]
    const message = {
      type: 'subscribe',
      channel: channelName,
      product_ids: products,
    };
    const subscribeMsg = self.signWithJWT(message, channelName, products);
    self.publicWebsocketFeed.send(JSON.stringify(subscribeMsg));
  }

  private unsubscribeToProducts(channelName: string) {
    const self = this
    const products = [self.coinbaseSymbol]
    const message = {
      type: 'unsubscribe',
      channel: channelName,
      product_ids: products,
    };
    const subscribeMsg = self.signWithJWT(message, channelName, products);
    self.publicWebsocketFeed.send(JSON.stringify(subscribeMsg));
  }

  public getRequest = async (endpoint: string, paramsData: any, body = undefined) => {
    const self = this
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = self.route + endpoint
    const paramKeys = Object.keys(paramsData)
    let params = paramKeys.length > 0 ? "?" : ""
    for (const key of paramKeys) {
      params += key + "=" + paramsData[key] + "&"
    }

    const bodyData = body !== undefined ? JSON.stringify(body) : ""

    const msg = timestamp + "GET" + path + bodyData
    const sig = self.sign(msg, self.credential.secret)

    let url = self.restUrl + path;

    url = url.replace("https://", "");

    console.error(`GET ${url}`);

    const jwt = self.generateJwt(`GET ${url}`);

    const headers = {
      "Authorization": `Bearer ${jwt}`
    };

    try {
      return (await axios.get(self.restUrl + path + "" + params, { headers })).data
    } catch (e) {
      console.error(e)
    }
  }

  public postRequest = async (endpoint: string, body: any = undefined) => {
    const self = this
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const path = self.route + endpoint
    const bodyData = body !== undefined ? JSON.stringify(body) : ""

    const msg = timestamp + "POST" + path + bodyData

    let url = self.restUrl + path;

    url = url.replace("https://", "");

    const jwt = self.generateJwt(`POST ${url}`);

    const headers = {
      "Authorization": `Bearer ${jwt}`
    };

    try {
      return (await axios.post(self.restUrl + path, bodyData, { headers })).data
    } catch (e) {
      console.error(e)
    }

  }

  private generateJwt(uri: string) {

    const payload = {
      iss: 'cdp',
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: this.credential.key,
      uri,
    };

    const header = {
      alg: 'ES256',
      kid: this.credential.key,
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    return jwt.sign(payload, this.credential.secret, { algorithm: 'ES256', header });

  }

  private signWithJWT(message, channel, products = []) {

    const payload = {
      iss: "cdp",
      nbf: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 120,
      sub: this.credential.key,
    };

    const header = {
      alg: 'ES256',
      kid: this.credential.key,
      nonce: crypto.randomBytes(16).toString('hex'),
    };

    const result = jwt.sign(payload, this.credential.secret, { algorithm: 'ES256', header });


    return { ...message, jwt: result };
  }
}
