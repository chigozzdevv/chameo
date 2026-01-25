import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "@/config";
import { ConflictError, UnauthorizedError, NotFoundError } from "@/shared";
import { sendEmail } from "@/lib/messaging";
import { getFrontendUrl, renderEmailTemplate } from "@/lib/messaging/template";
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

export async function requestPasswordReset(email: string): Promise<void> {
  const col = usersCollection();
  const user = await col.findOne({ email: email.toLowerCase() });
  if (!user) throw new NotFoundError("Email not found");

  const resetToken = jwt.sign({ userId: user._id!.toString(), email: user.email }, env.jwt.secret, { expiresIn: "1h" } as jwt.SignOptions);

  const resetUrl = `${getFrontendUrl()}/reset-password?token=${resetToken}`;
  const html = renderEmailTemplate({
    title: "Reset your password",
    preheader: "Reset your Chameo password.",
    body: `
      <p style="margin:0 0 12px;">Use the link below to reset your Chameo password.</p>
      <p style="margin:0;">This link expires in 1 hour.</p>
    `,
    cta: { label: "Reset password", url: resetUrl },
  });

  await sendEmail(user.email, "Reset your password", html, { from: env.resend.fromAuth });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, env.jwt.secret) as AuthPayload;
  } catch {
    throw new UnauthorizedError("Invalid or expired reset token");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const col = usersCollection();
  await col.updateOne({ email: payload.email }, { $set: { passwordHash } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const col = usersCollection();
  const user = await col.findOne({ _id: userId as any });
  if (!user) throw new NotFoundError("User not found");

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) throw new UnauthorizedError("Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await col.updateOne({ _id: userId as any }, { $set: { passwordHash } });
}
