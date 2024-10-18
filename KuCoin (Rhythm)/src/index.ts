import { KuCoinPublicConnector } from "./public/kucoin-spot-public-connector";
import { KuCoinPrivateConnector } from "./private/kucoin-spot-private-connector";
import { onMessage } from "./public/event-handlers";
import { config } from "dotenv";
import logger from "./logger";
import { v4 as uuidv4 } from "uuid";

config();

const main = async () => {
  // Initialize the public connector
  const publicConnector = new KuCoinPublicConnector(onMessage);

  // Initialize the private connector
  const apiKey = process.env.KUCOIN_API_KEY;
  const apiSecret = process.env.KUCOIN_API_SECRET;
  const apiPassphrase = process.env.KUCOIN_API_PASSPHRASE;

  if (!apiKey || !apiSecret || !apiPassphrase) {
    throw new Error("Missing required environment variables for KuCoin API");
  }

  const privateConnector = new KuCoinPrivateConnector(
    apiKey,
    apiSecret,
    apiPassphrase,
    onMessage
  );

  // Add desired subscription channels for the public connector
  publicConnector.addSubscription("/market/ticker:BTC-USDT");
  publicConnector.addSubscription("/market/match:BTC-USDT");
  publicConnector.addSubscription("/market/level2:BTC-USDT");

  // Connect the public connector
  await publicConnector.connect();

  // Connect the private connector
  await privateConnector.connect();

  // Making the order
  const placeOrderExample = {
    clientOid: uuidv4(),              // Generates a unique order ID
    side: "buy" as "buy",             // Order side: 'buy' or 'sell'
    symbol: "BTC-USDT",               // Trading pair
    type: "limit" as "limit",         // Order type: 'limit' or 'market'
    price: "20000",                   // Price for limit orders
    size: "0.01",                     // Amount to buy/sell
    timeInForce: "GTC" as "GTC",      // Time in force
  };

  // Example of placing an order
  try {
    const orderResponse = await privateConnector.placeOrder(placeOrderExample);
    logger.info(`Order placed successfully: ${JSON.stringify(orderResponse)}`);
  } catch (error) {
    logger.error(`Error placing order: ${(error as Error).message}`);
  }

  // Example of getting the account balance
  try {
    const balance = await privateConnector.getBalance("ETH");
    logger.info(`Balance: ${balance}`);
  } catch (error) {
    logger.error(`Error getting balance: ${(error as Error).message}`);
  }

  const shutdown = async () => {
    logger.info("Shutting down connectors...");
    publicConnector.stop();
    privateConnector.stop();
    logger.info("Connectors stopped.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // example timeout to shut down the connectors after 60 seconds.
  setTimeout(async () => {
    await shutdown();
  }, 60000);
};

main();
