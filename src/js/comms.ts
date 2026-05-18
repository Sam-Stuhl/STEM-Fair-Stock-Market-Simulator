// comms.ts — WebSocket communication layer with localStorage fallback.
// Replaces direct localStorage calls so pages work across devices.

type MessageHandler = (payload: string) => void;

interface WireMessage {
    topic: string;
    payload: string;
}

class Comms {
    private ws: WebSocket | null = null;
    private _connected = false;
    private _clientCount = 0;
    private handlers = new Map<string, Set<MessageHandler>>();
    private localCache = new Map<string, string>();
    private pendingQueue: WireMessage[] = [];
    private retryDelay = 1000;
    private retryTimer: ReturnType<typeof setTimeout> | null = null;

    // Auto-derive ws:// or wss:// URL from the page's own host.
    // Falls back to localStorage-only if the connection fails within 2s.
    connect(url?: string): void {
        const wsUrl = url ?? (
            window.location.protocol === 'https:'
                ? `wss://${window.location.host}`
                : `ws://${window.location.host}`
        );

        // Don't try to connect if there's no server (file:// protocol)
        if (window.location.protocol === 'file:') return;

        try {
            this.ws = new WebSocket(wsUrl);
        } catch {
            return; // Invalid URL or browser blocked it — stay in localStorage mode
        }

        this.ws.onopen = () => {
            this._connected = true;
            this.retryDelay = 1000;
            // Flush any publishes that were queued before the socket opened
            for (const msg of this.pendingQueue) {
                this.ws!.send(JSON.stringify(msg));
            }
            this.pendingQueue = [];
        };

        this.ws.onmessage = (event: MessageEvent) => {
            let msg: WireMessage;
            try { msg = JSON.parse(event.data as string); } catch { return; }
            if (typeof msg.topic !== 'string' || typeof msg.payload !== 'string') return;

            if (msg.topic === '__clients__') {
                this._clientCount = parseInt(msg.payload, 10);
            }

            // Mirror into localStorage and local cache so polling code still works
            this.localCache.set(msg.topic, msg.payload);
            try { localStorage.setItem(msg.topic, msg.payload); } catch { /* private browsing */ }

            // Fire any registered subscribers
            const handlers = this.handlers.get(msg.topic);
            if (handlers) handlers.forEach(h => h(msg.payload));
        };

        this.ws.onclose = () => {
            this._connected = false;
            this.ws = null;
            // Reconnect with exponential backoff (cap at 30s)
            this.retryTimer = setTimeout(() => {
                this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
                this.connect(wsUrl);
            }, this.retryDelay);
        };

        this.ws.onerror = () => {
            // onclose fires next; backoff reconnect handles it
        };
    }

    // Send a value on a topic. Always writes to localStorage (single-device fallback).
    // Also sends over WebSocket when connected, or queues for when it opens.
    publish(topic: string, payload: string): void {
        this.localCache.set(topic, payload);
        try { localStorage.setItem(topic, payload); } catch { /* private browsing */ }

        const msg: WireMessage = { topic, payload };
        if (this._connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.pendingQueue.push(msg);
        }
        // If no WebSocket at all, localStorage write above is the entire fallback
    }

    // Read the latest known value for a topic.
    // Checks in-memory cache first (populated by WebSocket), then localStorage.
    getLatest(topic: string): string | null {
        return this.localCache.get(topic) ?? localStorage.getItem(topic);
    }

    // Remove one or more topics from the local cache and localStorage so the next
    // getLatest() call returns null instead of a stale value.
    clearTopics(...topics: string[]): void {
        for (const topic of topics) {
            this.localCache.delete(topic);
            try { localStorage.removeItem(topic); } catch { /* private browsing */ }
        }
    }

    // Register a callback that fires whenever a remote device publishes to this topic.
    // NOTE: does NOT fire for values published by this same page.
    subscribe(topic: string, handler: MessageHandler): void {
        if (!this.handlers.has(topic)) this.handlers.set(topic, new Set());
        this.handlers.get(topic)!.add(handler);
    }

    get isConnected(): boolean { return this._connected; }
    get clientCount(): number  { return this._clientCount; }
}

export const comms = new Comms();
