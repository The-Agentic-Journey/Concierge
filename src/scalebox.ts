import { config } from "./config.js";
import { getKeyPair } from "./keygen.js";

interface VMResponse {
  id: string;
  name: string;
  template: string;
  ip: string;
  ssh_port: number;
  ssh: string;
  url: string | null;
  status: "running" | "stopped";
  created_at: string;
}

export class ScaleboxClient {
  private baseUrl: string;
  private token: string;

  constructor() {
    this.baseUrl = config.scalebox.apiUrl;
    this.token = config.scalebox.apiToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Scalebox API error: ${res.status} - ${text}`);
    }

    return res.json();
  }

  async createVM(): Promise<VMResponse> {
    const { publicKey } = getKeyPair();
    return this.request<VMResponse>("POST", "/vms", {
      template: config.scalebox.template,
      ssh_public_key: publicKey,
    });
  }

  async deleteVM(id: string): Promise<void> {
    await this.request("DELETE", `/vms/${id}`);
  }

  async getVM(id: string): Promise<VMResponse> {
    return this.request<VMResponse>("GET", `/vms/${id}`);
  }
}

export const scalebox = new ScaleboxClient();
