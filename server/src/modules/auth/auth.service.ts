import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "@/config";
import { ConflictError, UnauthorizedError } from "@/shared";
import { usersCollection, type AuthPayload } from "./auth.model";

export async function signup(email: string, password: string, orgName: string): Promise<{ user: AuthPayload; token: string }> {
  const col = usersCollection();
  const existing = await col.findOne({ email: email.toLowerCase() });
  if (existing) throw new ConflictError("Email already registered");

  const orgSlug = orgName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const slugExists = await col.findOne({ orgSlug });
  if (slugExists) throw new ConflictError("Organization name already taken");

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await col.insertOne({
    email: email.toLowerCase(),
    passwordHash,
    orgName,
    orgSlug,
    createdAt: Date.now(),
  });

  const userId = result.insertedId.toString();
  const payload: AuthPayload = { userId, email: email.toLowerCase(), orgSlug };
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as jwt.SignOptions);

  return { user: payload, token };
}

export async function login(email: string, password: string): Promise<{ user: AuthPayload; token: string }> {
  const col = usersCollection();
  const user = await col.findOne({ email: email.toLowerCase() });
  if (!user) throw new UnauthorizedError("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Invalid credentials");

  const payload: AuthPayload = { userId: user._id!.toString(), email: user.email, orgSlug: user.orgSlug };
  const token = jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn } as jwt.SignOptions);

  return { user: payload, token };
}

export function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, env.jwt.secret) as AuthPayload;
  } catch {
    throw new UnauthorizedError("Invalid token");
  }
}
