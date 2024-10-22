import * as Types from "./types"


export function onMessage(data: Types.Serializable[]): void {
    data.forEach(item => {
        // Process each item
        console.log("Processing item:", item);
        // Add your processing logic here
        const payload = JSON.parse(JSON.stringify(item));
        if (payload.event === "Trade") {
            // Process the BitgetTrade data
            console.log("Processing BitgetTrade data:", payload);
        } else if (payload.event === "Ticker") {
            // Process the BitgetTicker data
            console.log("Processing BitgetTicker data:", payload);
        } else {
            // Process error
            console.log("Error processing Serialized message");
        }
    });
}

// Example usage
// const exampleData: Types.Serializable[] = [
//     { id: 1, name: "Item 1" },
//     { id: 2, name: "Item 2" }
// ];

// onMessage(exampleData);