import { MongoClient, Db, Collection, Document } from "mongodb";
import { config } from "@/config";
let client: MongoClient | null = null;
let db: Db | null = null;
export async function connectDb(): Promise<Db> {
  if (db) return db;
  client = new MongoClient(config.mongodb.uri);
  await client.connect();
  db = client.db(config.mongodb.dbName);
  await db.collection("campaigns").createIndex({ id: 1 }, { unique: true });
  await db.collection("campaigns").createIndex({ expiresAt: 1 });
  await db.collection("wallets").createIndex({ campaignId: 1 }, { unique: true });
  await db.collection("claims").createIndex({ campaignId: 1, identityHash: 1 }, { unique: true });
  await db.collection("otps").createIndex({ key: 1 }, { unique: true });
  await db.collection("otps").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("magicLinks").createIndex({ token: 1 }, { unique: true });
  await db.collection("magicLinks").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("verificationTokens").createIndex({ token: 1 }, { unique: true });
  await db.collection("verificationTokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
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
export function col<T extends Document>(name: string): Collection<T> {
  return getDb().collection<T>(name);
}
