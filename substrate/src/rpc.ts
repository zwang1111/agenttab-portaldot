import { PORTALDOT_V3_RPC, PORTALDOT_V3_SUBSTRATE_RPC } from "agenttab-portaldot-sdk";

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };

/**
 * Minimal JSON-RPC over the Node 22 WebSocket global.
 * Used only for `state_*` / `system_*` reads. This client has no submit method.
 */
export class SubstrateRpc {
  private ws: WebSocket | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor(private readonly url = PORTALDOT_V3_SUBSTRATE_RPC) {}

  async connect(): Promise<void> {
    const Socket = globalThis.WebSocket;
    if (!Socket) throw new Error("global WebSocket is missing; Node 22+ is required");
    const ws = new Socket(this.url);
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("substrate websocket timed out")), 20_000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error(`substrate websocket failed: ${this.url}`));
      });
    });
    ws.addEventListener("message", (event) => {
      const payload = typeof event.data === "string" ? event.data : Buffer.from(event.data as ArrayBuffer).toString("utf8");
      const msg = JSON.parse(payload) as { id?: number; result?: unknown; error?: { message?: string } };
      if (msg.id == null) return;
      const pending = this.pending.get(msg.id);
      if (!pending) return;
      this.pending.delete(msg.id);
      if (msg.error) pending.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else pending.resolve(msg.result);
    });
  }

  call<T>(method: string, params: unknown[] = []): Promise<T> {
    if (!this.ws) throw new Error("substrate rpc is not connected");
    if (method === "author_submitExtrinsic" || method === "author_submitAndWatchExtrinsic") {
      throw new Error("refusing to submit an extrinsic");
    }
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.ws!.send(JSON.stringify({ jsonrpc: "2.0", id, method, params }));
    });
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
  }
}

export async function evmCall<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(PORTALDOT_V3_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`evm rpc http ${response.status}`);
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message ?? JSON.stringify(body.error));
  return body.result as T;
}
