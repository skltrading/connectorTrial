
interface Config {
  exchangeClientID: string;
  exchangeClientSecret: string;
}

export const envConfig: Config = {
  exchangeClientID: process.env.CLIENT_ID,
  exchangeClientSecret: process.env.CLIENT_SECRET,
};
