import { env } from "@/config";

interface VaultResponse<T> {
  data: { data: T };
}

class VaultClient {
  private baseUrl: string;
  private token: string;
  private mountPath: string;

  constructor() {
    this.baseUrl = env.vault.address;
    this.token = env.vault.token;
    this.mountPath = env.vault.mountPath;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/v1/${path}`, {
      method,
      headers: {
        "X-Vault-Token": this.token,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Vault error: ${res.status} - ${error}`);
    }
    if (res.status === 204) return {} as T;
    return res.json();
  }

  async storeSecret(key: string, data: Record<string, string>): Promise<void> {
    await this.request("POST", `${this.mountPath}/data/${key}`, { data });
  }

  async getSecret<T extends Record<string, string>>(key: string): Promise<T | null> {
    try {
      const res = await this.request<VaultResponse<T>>("GET", `${this.mountPath}/data/${key}`);
      return res.data.data;
    } catch (error: any) {
      if (error.message.includes("404")) return null;
      throw error;
    }
  }

  async deleteSecret(key: string): Promise<void> {
    await this.request("DELETE", `${this.mountPath}/metadata/${key}`);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/sys/health`, {
        headers: { "X-Vault-Token": this.token },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}

export const vault = new VaultClient();
