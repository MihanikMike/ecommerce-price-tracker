import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
let client = null;

export async function connectDB() {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    return client.db("price_tracker");
}

export async function closeDB() {
    if (client) {
        await client.close();
        client = null;
    }
}