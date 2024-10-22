import * as Types from "./types"


export function onMessage(data: Types.Serializable[]): void {
    data.forEach(item => {
        // Process each item
        console.log("Processing item:", item);
        // Add your processing logic here
        const payload = JSON.parse(JSON.stringify(item));
        if (payload.event === "subscribe") {
            // Process the subscribed data
            console.log("Processing BitgetTrade subscribed channels:", payload);
        } else if (payload.channel === "orders") {
            // Process the snapshot data
            console.log("Processing BitgetTrade subscribed channels:", payload);
        } else if (payload.channel === "account") {
            // Process the snapshot data
            console.log("Processing BitgetTrade Account Information:", payload);
        } else {
            // Process error
            console.log("Error processing Serialized message");
        }
    });
}

export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Example usage
// const exampleData: Types.Serializable[] = [
//     { id: 1, name: "Item 1" },
//     { id: 2, name: "Item 2" }
// ];

// onMessage(exampleData);