export class OrderBook {
    private bids: Map<string, string>;
    private asks: Map<string, string>;

    constructor() {
        this.bids = new Map();
        this.asks = new Map();
    }

    /**
     * Updates the order book with new changes.
     * @param changes - The changes to apply.
     */
    public update(changes: { asks: [string, string][]; bids: [string, string][]; }) {
        changes.bids.forEach(([price, size]) => {
            if (parseFloat(size) === 0) {
                this.bids.delete(price);
            } else {
                this.bids.set(price, size);
            }
        });

        changes.asks.forEach(([price, size]) => {
            if (parseFloat(size) === 0) {
                this.asks.delete(price);
            } else {
                this.asks.set(price, size);
            }
        });
    }

    /**
     * Retrieves the current bids.
     */
    public getBids() {
        return Array.from(this.bids.entries()).sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
    }

    /**
     * Retrieves the current asks.
     */
    public getAsks() {
        return Array.from(this.asks.entries()).sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]));
    }
}