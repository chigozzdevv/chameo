import { apiFetch } from "./api";

export type AuthUser = {
  userId: string;
  email: string;
  orgSlug: string;
};

export type AuthResult = {
  user: AuthUser;
  token: string;
};

const TOKEN_KEY = "chameo_token";
const USER_KEY = "chameo_user";

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthSession(result: AuthResult) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, result.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(result.user));
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

export async function login(email: string, password: string): Promise<AuthResult> {
  return apiFetch<AuthResult>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function signup(
  email: string,
  password: string,
  orgName: string
): Promise<AuthResult> {
  return apiFetch<AuthResult>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, orgName }),
  });
}
