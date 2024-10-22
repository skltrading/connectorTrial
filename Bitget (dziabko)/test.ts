import { BitgetFuturesPublicConnector } from "./bitget-futures-public-connector";
import { onMessage } from "./bitget-datahandler";
import 'dotenv/config';
import { BitgetFuturesPrivateConnector } from "./bitget-futures-private-connector";
import CryptoJS from 'crypto-js';
import * as BitgetApi from "bitget-api-node-sdk";
// import WebSocketServer from 'ws';
import { WebSocket } from 'ws';
import * as Types from "./types"




import axios, { AxiosStatic } from 'axios';
import { connected, exit } from "process";

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


class ListennerObj extends BitgetApi.Listenner{
    reveice(message: string){
        console.info('>>>'+message);
    }
}


function handleMessage(data: string): void {
    const message = JSON.parse(data);
    if (message.event == 'login') {
        console.log("LOGGED IN");
    } else if (message.event == 'subscribe') {
        console.log("SUBSCRIBED TO: ", message);
    }else if (message.event == 'error') {
        console.log("ERROR: ", message);
    } else if (message.action == 'snapshot') {  // If the message is a SUSDT-FUTURES order
        console.log("SNAPSHOT: ", message);
    } else {
        console.log("Unknown event: ", message);
    }
}



export async function main() {
    const bitgetConnector = new BitgetFuturesPrivateConnector()
    bitgetConnector.connect(onMessage)

    // Ensure the websocket is open, and a connection established
    await delay(3000);
    if (bitgetConnector.privateWSFeed.readyState === WebSocket.OPEN) {
        console.log("Websocket is open");
    } else if (bitgetConnector.privateWSFeed.readyState === WebSocket.CLOSED) {
        console.log("Websocket is closed");
    }

    // Test place order batching with 2 orders
    const order1: Types.FuturesLimitOrderRequest = {
        size: "0.10",
        side: "buy",
        orderType: "limit",
        force: "gtc",
        price: "20000",
    }
    const order2: Types.FuturesLimitOrderRequest = {
        size: "0.10",
        side: "sell",
        orderType: "limit",
        force: "gtc",
        price: "200000",
    }
    const batchOrder: Types.BatchFuturesLimitOrdersRequest = {
        symbol: 'SBTCSUSDT',
        productType: "SUSDT-FUTURES",
        marginMode: "crossed",
        marginCoin: "SUSDT",
        orderList: [order1, order2]
    }


    console.log(JSON.stringify(batchOrder));

    // Place 2 SUSDT-FUTURES limit orders on the FUTURES SBTCUSDT market
    // Give 5 seconds for the orders to be placed
    bitgetConnector.placeOrders(batchOrder);
    await delay(5000);

    const openOrderRequest: Types.OpenOrdersRequest = {
        productType: "SUSDT-FUTURES",
        symbol: "SBTCSUSDT",
    }

    // Get all active orders
    const orderStatusUpdate = await bitgetConnector.getCurrentActiveOrders(openOrderRequest);
    console.log("ORDER STATUS: ", orderStatusUpdate);

    // Ensure that currently retreived open orders are the same as the orders placed
    orderStatusUpdate.forEach((order) => {
        if (order.side == "buy") {
            // Check that the buy order is the same as the order1
            if (order.size != order1.size 
                || order.side != order1.side
                || order.orderType != order1.orderType
                || order.force != order1.force
                || order.price.toString() != order1.price
                || order.symbol != batchOrder.symbol
                || order.marginMode != batchOrder.marginMode
                || order.marginCoin != batchOrder.marginCoin) {
                    console.log("order1 is not matching one of the open orders");
                } else {
                    console.log("order1 is matching one of the open orders");
                }
        } else if (order.side == "sell") {
            // Check that the sell order is the same as the order2
            if (order.size != order2.size 
                || order.side != order2.side
                || order.orderType != order2.orderType
                || order.force != order2.force
                || order.price.toString() != order2.price
                || order.symbol != batchOrder.symbol
                || order.marginMode != batchOrder.marginMode
                || order.marginCoin != batchOrder.marginCoin) {
                    console.log("order2 is not matching one of the open orders");
                } else {
                    console.log("order2 is matching one of the open orders");
                }
        }
    })

    // Ensure that deleteAllOrders orders works
    let cancelOrders: Types.CancelOrdersRequest[] = orderStatusUpdate.map((order) => {
        return {
            symbol: order.symbol,
            productType: openOrderRequest.productType,
            marginCoin: order.marginCoin,
            orderId: order.orderId,
            clientOid: order.clientOid,
        }
    });
    let cancelOrderReq: Types.BatchCancelOrdersRequest = {
        orderList: cancelOrders,
    }

    // Get Balance Percentage
    const balanceResp = await bitgetConnector.getBalancePercentage({productType: "SUSDT-FUTURES"});
    if (balanceResp.inventory > 99) {
        console.log("BalancePercentage utilization is above 99% which is incredibly unlikely to be correct based on the number of DEMO tokens given to each account (~3000SUSDT)");
    }

    // Delete all the orders we opened
    await bitgetConnector.deleteAllOrders(cancelOrderReq);
    const activeOrders2 = await bitgetConnector.getCurrentActiveOrders(openOrderRequest);

    // Get Balance Percentage
    const balanceResp2 = await bitgetConnector.getBalancePercentage({productType: "SUSDT-FUTURES"});
    if (balanceResp.inventory >= balanceResp2.inventory) {
        console.log("BalancePercentage should have increased after deleting all open orders");
    }
    
    // Verify the balance change of the account with closing the open orders (We're assuming we used at least 100USDT on both the open orders)
    if (balanceResp.baseBalance - balanceResp2.baseBalance < 100) {
        console.log("Balance should have increased by at least 100USDT after deleting all open orders");
    }

    await bitgetConnector.stop(openOrderRequest)
    console.log("Stopped the websocket feed");
    exit(0);
}

main();