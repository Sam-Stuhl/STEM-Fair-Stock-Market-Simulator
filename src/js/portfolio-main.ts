// Portfolio view logic — receives price updates via WebSocket / localStorage from the chart window

import { comms } from './comms.js';

const isPreview = window.self !== window.top;
comms.connect();

// Show landing screen until controller activates this page.
// In preview mode skip the gate — it's always visible in the controller iframe.
if (!isPreview) {
    let portfolioStarted = false;
    comms.subscribe('stock-sim-portfolio-active', (val) => {
        if (val !== 'true' || portfolioStarted) return;
        portfolioStarted = true;
        const overlay = document.getElementById('landing-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        }
    });
}

const STARTING_CASH    = 50;
const STARTING_SHARES  = 10;
const STARTING_PRICE   = 10;
const STARTING_WORTH   = STARTING_CASH + STARTING_SHARES * STARTING_PRICE; // $150

// ── State ──────────────────────────────────────────────────────────────────

let cash = STARTING_CASH;
let sharesOwned = STARTING_SHARES;
let currentPrice = STARTING_PRICE;
let priceReceived = false;

interface Transaction {
    type: 'buy' | 'sell';
    quantity: number;
    price: number;
    cashAfter: number;
    sharesAfter: number;
    timestamp: string;
}

const transactions: Transaction[] = [];

// ── Derived values ─────────────────────────────────────────────────────────

function marketValue(): number { return sharesOwned * currentPrice; }
function totalValue(): number  { return cash + marketValue(); }
function pnl(): number         { return totalValue() - STARTING_WORTH; }

// ── DOM refs ───────────────────────────────────────────────────────────────

const elPrice       = document.getElementById('portfolio-price')!;
const elStatus      = document.getElementById('price-status')!;
const elCash        = document.getElementById('stat-cash')!;
const elShares      = document.getElementById('stat-shares')!;
const elMarketValue = document.getElementById('stat-market-value')!;
const elPnl         = document.getElementById('stat-pnl')!;
const elTradeCost   = document.getElementById('trade-cost')!;
const elTradeError  = document.getElementById('trade-error')!;
const elHistoryList = document.getElementById('history-list')!;
const elBuy         = document.getElementById('btn-buy') as HTMLButtonElement;
const elSell        = document.getElementById('btn-sell') as HTMLButtonElement;
const elQtyInput    = document.getElementById('quantity-input') as HTMLInputElement;

// ── Formatting helpers ─────────────────────────────────────────────────────

function fmtMoney(n: number): string {
    const abs = Math.abs(n).toFixed(2);
    const formatted = Number(abs).toLocaleString('en-US', { minimumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '$' + formatted;
}

function fmtTimestamp(): string {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ── UI rendering ───────────────────────────────────────────────────────────

function renderStats(): void {
    elCash.textContent        = fmtMoney(cash);
    elShares.textContent      = sharesOwned.toString();
    elMarketValue.textContent = fmtMoney(marketValue());

    const gain = pnl();
    const pct  = ((gain / STARTING_CASH) * 100).toFixed(2);
    elPnl.textContent = `${fmtMoney(gain)} (${gain >= 0 ? '+' : ''}${pct}%)`;
    elPnl.className   = 'stat-value ' + (gain >= 0 ? 'positive' : 'negative');
}

function renderPrice(): void {
    elPrice.textContent = priceReceived ? '$' + currentPrice.toFixed(2) : '--';
}

function renderTradeCost(): void {
    const qty = getQuantity();
    if (!priceReceived || qty <= 0) {
        elTradeCost.innerHTML = '&nbsp;';
        return;
    }
    const cost = qty * currentPrice;
    elTradeCost.textContent = `${qty} share${qty === 1 ? '' : 's'} × $${currentPrice.toFixed(2)} = ${fmtMoney(cost)}`;
}

function renderButtons(): void {
    const qty = getQuantity();
    elBuy.disabled  = !priceReceived || qty <= 0 || qty * currentPrice > cash;
    elSell.disabled = !priceReceived || qty <= 0 || qty > sharesOwned;
}

function renderHistory(): void {
    if (transactions.length === 0) {
        elHistoryList.innerHTML = '<div class="history-empty">No transactions yet</div>';
        return;
    }

    elHistoryList.innerHTML = '';

    // Show most recent first
    for (let i = transactions.length - 1; i >= 0; i--) {
        const tx = transactions[i];
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <span class="history-badge ${tx.type}">${tx.type.toUpperCase()}</span>
            <span class="history-detail">${tx.quantity} share${tx.quantity === 1 ? '' : 's'} @ $${tx.price.toFixed(2)}</span>
            <span class="history-balance">${fmtMoney(tx.cashAfter)} cash · ${tx.sharesAfter} shares · ${tx.timestamp}</span>
        `;
        elHistoryList.appendChild(item);
    }
}

function renderAll(): void {
    renderStats();
    renderPrice();
    renderTradeCost();
    renderButtons();
    comms.publish('stock-sim-portfolio', JSON.stringify({
        cash,
        shares:      sharesOwned,
        marketValue: marketValue(),
        pnl:         pnl(),
        txCount:     transactions.length,
        transactions: transactions.slice(-30).map(tx => ({
            type: tx.type, quantity: tx.quantity, price: tx.price, timestamp: tx.timestamp
        })),
    }));
}

// ── Trade logic ────────────────────────────────────────────────────────────

function getQuantity(): number {
    const val = parseInt(elQtyInput.value, 10);
    return isNaN(val) || val < 1 ? 0 : val;
}

function showError(msg: string): void {
    elTradeError.textContent = msg;
    setTimeout(() => { elTradeError.textContent = ''; }, 2500);
}

function executeBuy(): void {
    const qty  = getQuantity();
    const cost = qty * currentPrice;

    if (qty <= 0)     { showError('Enter a valid quantity.'); return; }
    if (cost > cash)  { showError(`Not enough cash. Need ${fmtMoney(cost)}, have ${fmtMoney(cash)}.`); return; }

    cash -= cost;
    sharesOwned += qty;

    transactions.push({
        type: 'buy', quantity: qty, price: currentPrice,
        cashAfter: cash, sharesAfter: sharesOwned,
        timestamp: fmtTimestamp()
    });

    renderAll();
    renderHistory();
}

function executeSell(): void {
    const qty = getQuantity();

    if (qty <= 0)           { showError('Enter a valid quantity.'); return; }
    if (qty > sharesOwned)  { showError(`Only own ${sharesOwned} share${sharesOwned === 1 ? '' : 's'}.`); return; }

    cash += qty * currentPrice;
    sharesOwned -= qty;

    transactions.push({
        type: 'sell', quantity: qty, price: currentPrice,
        cashAfter: cash, sharesAfter: sharesOwned,
        timestamp: fmtTimestamp()
    });

    renderAll();
    renderHistory();
}

// ── Event listeners ────────────────────────────────────────────────────────

elBuy.addEventListener('click',  executeBuy);
elSell.addEventListener('click', executeSell);

elQtyInput.addEventListener('input', () => {
    renderTradeCost();
    renderButtons();
    // Clear active state from quick-select buttons when manually typing
    document.querySelectorAll<HTMLButtonElement>('.qty-btn').forEach(b => b.classList.remove('active'));
});

document.querySelectorAll<HTMLButtonElement>('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const qty = btn.dataset.qty ?? '1';
        elQtyInput.value = qty;
        document.querySelectorAll<HTMLButtonElement>('.qty-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTradeCost();
        renderButtons();
    });
});

// ── Preview mode: sync from published snapshots, don't track own state ────

if (isPreview) {
    setInterval(() => {
        // Sync portfolio state from the real portfolio page's published snapshot
        const rawPf = localStorage.getItem('stock-sim-portfolio');
        if (rawPf) {
            try {
                const pf = JSON.parse(rawPf);
                cash        = pf.cash   ?? STARTING_CASH;
                sharesOwned = pf.shares ?? 0;
            } catch { /* ignore */ }
        }

        // Sync price
        const rawPrice = localStorage.getItem('stock-sim-price');
        if (rawPrice) {
            const p = parseFloat(rawPrice);
            if (isFinite(p)) {
                currentPrice  = p;
                priceReceived = true;
                elStatus.textContent = 'Live';
                elStatus.style.color = '#26a69a';
            }
        }

        renderStats();
        renderPrice();
    }, 300);

    renderAll(); // initial render
} else {

// ── Price sync: WebSocket push (instant) + localStorage poll (fallback) ───

function applyPrice(raw: string): void {
    const newPrice = parseFloat(raw);
    if (!isFinite(newPrice)) return;

    const wasReceived = priceReceived;
    currentPrice  = newPrice;
    priceReceived = true;

    if (!wasReceived) {
        elStatus.textContent = 'Live';
        elStatus.style.color = '#26a69a';
    }

    renderAll();
}

// WebSocket push — fires immediately when chart publishes a new price
comms.subscribe('stock-sim-price', applyPrice);

// Polling fallback — keeps things working in single-device localStorage mode
setInterval(() => {
    const raw = comms.getLatest('stock-sim-price');
    if (raw) applyPrice(raw);
}, 150);

// Reset signal from admin page
comms.subscribe('stock-sim-reset', () => window.location.reload());

// ── Initial render ─────────────────────────────────────────────────────────

renderAll();
renderHistory();

} // end !isPreview
