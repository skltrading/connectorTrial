import BtcTurkSpotPrivateConnector from './connetors/private/btcturk-spot-private-connector'
import BtcTurkSpotPublicConnector from './connetors/public/btcturk-spot-public-connector'

const publicKey = process.env.BTCTURK_PUBLIC_KEY || ''
const privateKey = process.env.BTCTURK_PRIVATE_KEY || ''
const gotCreds = !!publicKey && !!privateKey

const publicConnector = new BtcTurkSpotPublicConnector(
    { name: 'BTC' },
    { quoteAsset: 'USDT' },
)

publicConnector.debug = false
publicConnector.connect(data => console.log('BtcTurk Public: message received =>', data))

if (gotCreds) {
    const debugTag = 'BtcTurk Private:'
    const privateConnector = new BtcTurkSpotPrivateConnector(
        { name: 'DOT' },
        { quoteAsset: 'USDT' },
        { key: publicKey, secret: privateKey })

    privateConnector.debug = false
    console.log('Connecting to private connector')
    try {
        privateConnector
            .connect(data => console.log(debugTag, 'message received =>', data))
            .then(async () => {
                console.log(debugTag, 'Websocket Connected.')
                const order = {
                    price: 9.99,
                    side: 'Sell' as 'Sell',
                    size: 1,
                    type: 'Limit' as 'Limit',
                }

                console.log(debugTag, 'placing an order', { ...order })

                const orderResult = await privateConnector.placeOrders({ orders: [order] })
                console.log(debugTag, 'orderResult => ', orderResult)

                console.log(debugTag, 'cancelling all orders')
                const cancelResult = await privateConnector.deleteAllOrders({})
                console.log(debugTag, 'cancelResult', cancelResult)
            })
    } catch (err) {
        console.log(debugTag, 'websocket connection failed to connect', err)
    }
}