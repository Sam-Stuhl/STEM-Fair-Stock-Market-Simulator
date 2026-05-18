const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// ── MIME types ────────────────────────────────────────────────────────────────

const MIME = {
    '.html': 'text/html',
    '.css':  'text/css',
    '.js':   'application/javascript',
    '.json': 'application/json',
    '.png':  'image/png',
    '.ico':  'image/x-icon',
};

// ── Static file server ────────────────────────────────────────────────────────

function serveStatic(req, res) {
    let urlPath = req.url.split('?')[0]; // strip query string

    // Default route
    if (urlPath === '/' || urlPath === '') urlPath = '/src/index.html';

    // Resolve to filesystem path (everything is served relative to project root)
    const filePath = path.join(__dirname, urlPath);

    // Basic path traversal guard
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            // If no extension was given, try appending .html (e.g. /src/portfolio → /src/portfolio.html)
            if (!path.extname(filePath)) {
                fs.readFile(filePath + '.html', (err2, data2) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Not found: ' + urlPath);
                        return;
                    }
                    res.writeHead(200, { 'Content-Type': 'text/html' });
                    res.end(data2);
                });
                return;
            }
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found: ' + urlPath);
            return;
        }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    });
}

// ── HTTP + WebSocket server ───────────────────────────────────────────────────

const server = http.createServer(serveStatic);
const wss = new WebSocket.Server({ server });

// Cache: topic → latest payload string (so new clients sync immediately)
const lastValue = {};
const clients = new Set();
// Topics that are fire-and-forget: broadcast but never cached, so reconnecting
// clients don't re-receive a stale event and act on it again.
const NO_CACHE_TOPICS = new Set(['stock-sim-reset']);

function broadcastClientCount() {
    const payload = String(clients.size);
    lastValue['__clients__'] = payload;
    const msg = JSON.stringify({ topic: '__clients__', payload });
    for (const c of clients) {
        if (c.readyState === WebSocket.OPEN) c.send(msg);
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);

    // Replay all cached topic values so new client is immediately in sync
    for (const [topic, payload] of Object.entries(lastValue)) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ topic, payload }));
        }
    }

    broadcastClientCount();

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }
        const { topic, payload } = msg;
        if (typeof topic !== 'string' || typeof payload !== 'string') return;

        if (!NO_CACHE_TOPICS.has(topic)) {
            lastValue[topic] = payload;
        } else if (topic === 'stock-sim-reset') {
            // Wipe all sim state from the cache so reconnecting clients start clean
            delete lastValue['stock-sim-price'];
            delete lastValue['stock-sim-portfolio'];
            delete lastValue['stock-sim-regime'];
        }

        // Relay to all OTHER connected clients (sender already knows the value)
        for (const c of clients) {
            if (c !== ws && c.readyState === WebSocket.OPEN) {
                c.send(JSON.stringify({ topic, payload }));
            }
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        broadcastClientCount();
    });

    ws.on('error', () => {
        clients.delete(ws);
    });
});

server.listen(PORT, () => {
    console.log(`Stock Market Simulator running at http://localhost:${PORT}`);
    console.log(`  Chart:     http://localhost:${PORT}/src/index.html`);
    console.log(`  Portfolio: http://localhost:${PORT}/src/portfolio.html`);
    console.log(`  Admin:     http://localhost:${PORT}/src/controller.html`);
});
