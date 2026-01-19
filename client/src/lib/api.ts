export type AuthUser = {
  userId: string;
  email: string;
  orgSlug: string;
};

export type AuthResult = {
  user: AuthUser;
  token: string;
};

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

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

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = (await res.json()) as { message?: string; error?: string } & T;
  if (!res.ok) {
    throw new Error(data.message || data.error || "Request failed");
  }
  return data as T;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const result = await apiFetch<{ user: AuthUser; token: string }>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }
  );
  return result;
}

export async function signup(
  email: string,
  password: string,
  orgName: string
): Promise<AuthResult> {
  const result = await apiFetch<{ user: AuthUser; token: string }>(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password, orgName }),
    }
  );
  return result;
}
