import dotenv from 'dotenv';

dotenv.config();

export const DeribitSideMap: { [key: string]: String } = {
    'buy': 'Buy',
    'sell': 'Sell'
}