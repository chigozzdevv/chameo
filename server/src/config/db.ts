import { MongoClient, Db } from "mongodb";
import { env } from "./env";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(env.mongodb.uri);
  await client.connect();
  db = client.db(env.mongodb.dbName);
  console.log("Connected to MongoDB");
  return db;
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export function getDb(): Db {
  if (!db) throw new Error("Database not connected");
  return db;
}
