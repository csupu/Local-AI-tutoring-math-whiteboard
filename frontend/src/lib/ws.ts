/** Persistent WebSocket client for the MathTutor backend (/ws/chat). */

export type WsStatus = 'waiting' | 'thinking' | 'ready' | 'error';

export interface AiAction {
  op: 'add_text' | 'add_shape';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  text?: string;
  color?: string;
  size?: 's' | 'm' | 'l' | 'xl';
  shape?: 'rectangle' | 'ellipse' | 'line' | 'arrow';
}

export interface Envelope {
  status: 'thinking' | 'done' | 'error';
  error?: string;
  response?: string;
  model?: string;
  vision?: boolean;
  verified?: string;
  actions?: AiAction[];
}

export interface ChatRequest {
  model: string;
  mode: 'chat' | 'analyze' | 'actions';
  prompt: string;
  shapes: { type: string; props: Record<string, unknown> }[];
  image_base64?: string;
}

const WS_URL =
  `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/chat`;

let socket: WebSocket | null = null;
let status: WsStatus = 'waiting';
const statusListeners = new Set<(s: WsStatus) => void>();
const pending = new Map<number, (env: Envelope) => void>();
let sequence = 0;

function setStatus(next: WsStatus): void {
  status = next;
  statusListeners.forEach((fn) => fn(next));
}

function handleIncoming(event: MessageEvent): void {
  let env: Envelope;
  try {
    env = JSON.parse(String(event.data));
  } catch {
    return;
  }
  const cb = pending.get((env as { id?: number }).id as number);
  if (!cb) return;
  if (env.status === 'done' || env.status === 'error') {
    pending.delete((env as { id?: number }).id as number);
    cb(env);
  }
}

function connect(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const sock = new WebSocket(WS_URL);
    let settled = false;
    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        try { sock.close(); } catch { /* already closing */ }
        reject(new Error('Cannot reach the MathTutor backend. Start it with `start.cmd` (backend on port 8000).'));
      }
    }, 5000);
    sock.onopen = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(sock);
      }
    };
    sock.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error('Cannot connect to the MathTutor backend WebSocket.'));
      }
    };
  });
}

async function ensureSocket(): Promise<WebSocket> {
  if (socket && socket.readyState === WebSocket.OPEN) return socket;
  socket = null;
  const fresh = await connect();
  socket = fresh;
  fresh.onmessage = handleIncoming;
  fresh.onclose = () => {
    if (socket === fresh) socket = null;
    setStatus('waiting');
  };
  return fresh;
}

/** Send one request and resolve with the final (done/error) envelope. */
export async function chat(request: ChatRequest): Promise<Envelope> {
  const id = ++sequence;
  const sock = await ensureSocket();
  return new Promise<Envelope>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pending.delete(id);
      reject(new Error('Timed out waiting for the AI reply. Try again or pick a smaller model.'));
    }, 300000);
    pending.set(id, (env) => {
      clearTimeout(timer);
      resolve(env);
    });
    sock.send(JSON.stringify({ ...request, id }));
  });
}

export function subscribeStatus(fn: (s: WsStatus) => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

export function currentStatus(): WsStatus {
  return status;
}
