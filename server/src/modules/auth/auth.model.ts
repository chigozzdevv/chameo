import { Collection, ObjectId } from "mongodb";
import { getDb } from "@/config";

export interface UserDoc {
  _id?: ObjectId;
  email: string;
  passwordHash: string;
  orgName: string;
  orgSlug: string;
  createdAt: number;
}

export interface AuthPayload {
  userId: string;
  email: string;
  orgSlug: string;
}

export function usersCollection(): Collection<UserDoc> {
  return getDb().collection<UserDoc>("users");
}

export async function createUserIndexes(): Promise<void> {
  const col = usersCollection();
  await col.createIndex({ email: 1 }, { unique: true });
  await col.createIndex({ orgSlug: 1 }, { unique: true });
}
