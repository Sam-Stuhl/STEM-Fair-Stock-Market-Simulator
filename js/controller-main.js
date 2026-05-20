// Presenter controller — reads price + portfolio via WebSocket/localStorage, writes regime
import { comms } from './comms.js';
comms.connect();
// ── State ──────────────────────────────────────────────────────────────────
let currentPrice = 0;
let startPrice = 0;
let priceReceived = false;
let currentRegime = 'normal';
let regimeSince = Date.now();
// ── DOM refs ───────────────────────────────────────────────────────────────
const elConnDot = document.getElementById('conn-dot');
const elConnText = document.getElementById('conn-text');
const elClientCount = document.getElementById('ctrl-client-count');
const btnReset = document.getElementById('btn-reset');
const elStatus = document.getElementById('ctrl-status');
const elClock = document.getElementById('ctrl-clock');
const elPrice = document.getElementById('ctrl-price');
const elChange = document.getElementById('ctrl-change');
const elRegimeLabel = document.getElementById('ctrl-regime-label');
const elRegimeTime = document.getElementById('ctrl-regime-time');
const elCash = document.getElementById('ctrl-cash');
const elShares = document.getElementById('ctrl-shares');
const elMktVal = document.getElementById('ctrl-mktval');
const elPnl = document.getElementById('ctrl-pnl');
const elTxCount = document.getElementById('ctrl-tx-count');
const elTxList = document.getElementById('ctrl-tx-list');
const btnNormal = document.getElementById('btn-normal');
const btnBull = document.getElementById('btn-bull');
const btnBear = document.getElementById('btn-bear');
const btnActivateChart = document.getElementById('btn-activate-chart');
const btnActivatePortfolio = document.getElementById('btn-activate-portfolio');
// ── Helpers ────────────────────────────────────────────────────────────────
function fmtMoney(n) {
    const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : '') + '$' + abs;
}
function fmtDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
// ── Regime control ─────────────────────────────────────────────────────────
const REGIME_LABELS = {
    normal: 'Normal',
    bull: 'Bull Run',
    bear: 'Bear Run',
};
function applyRegime(regime) {
    currentRegime = regime;
    regimeSince = Date.now();
    comms.publish('stock-sim-regime', JSON.stringify({ regime, since: regimeSince }));
    updateRegimeButtons();
}
function updateRegimeButtons() {
    btnNormal.classList.toggle('active', currentRegime === 'normal');
    btnBull.classList.toggle('active', currentRegime === 'bull');
    btnBear.classList.toggle('active', currentRegime === 'bear');
    elRegimeLabel.textContent = REGIME_LABELS[currentRegime] ?? currentRegime;
}
btnNormal.addEventListener('click', () => applyRegime('normal'));
btnBull.addEventListener('click', () => applyRegime('bull'));
btnBear.addEventListener('click', () => applyRegime('bear'));
// ── Poll loop ──────────────────────────────────────────────────────────────
function poll() {
    // Clock
    elClock.textContent = new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    // Price from chart
    const rawPrice = comms.getLatest('stock-sim-price');
    if (rawPrice) {
        const p = parseFloat(rawPrice);
        if (isFinite(p)) {
            if (!priceReceived) {
                startPrice = p;
                elStatus.textContent = 'Live';
                elStatus.classList.add('live');
            }
            currentPrice = p;
            priceReceived = true;
        }
    }
    if (priceReceived) {
        elPrice.textContent = '$' + currentPrice.toFixed(2);
        const changePct = ((currentPrice - startPrice) / startPrice) * 100;
        const sign = changePct >= 0 ? '+' : '';
        elChange.textContent = `${sign}${changePct.toFixed(2)}%`;
        elChange.className = 'info-value ' + (changePct >= 0 ? 'positive' : 'negative');
    }
    // Regime time + auto-expire bull/bear after 60 seconds
    const regimeElapsed = Date.now() - regimeSince;
    elRegimeTime.textContent = fmtDuration(regimeElapsed);
    if (currentRegime !== 'normal' && regimeElapsed >= 120000) {
        applyRegime('normal');
    }
    // Portfolio from portfolio page
    const rawPf = comms.getLatest('stock-sim-portfolio');
    if (rawPf) {
        try {
            const pf = JSON.parse(rawPf);
            elCash.textContent = fmtMoney(pf.cash ?? 0);
            elShares.textContent = String(pf.shares ?? 0);
            elMktVal.textContent = fmtMoney(pf.marketValue ?? 0);
            const p = pf.pnl ?? 0;
            elPnl.textContent = fmtMoney(p);
            elPnl.className = 'info-value ' + (p >= 0 ? 'positive' : 'negative');
            elTxCount.textContent = String(pf.txCount ?? 0);
            renderTxFeed(pf.transactions ?? []);
        }
        catch { /* ignore malformed data */ }
    }
}
let lastTxCount = 0;
function renderTxFeed(txs) {
    if (txs.length === lastTxCount)
        return;
    lastTxCount = txs.length;
    if (txs.length === 0) {
        elTxList.innerHTML = '<div class="tx-empty">No transactions yet</div>';
        return;
    }
    elTxList.innerHTML = '';
    for (let i = txs.length - 1; i >= 0; i--) {
        const tx = txs[i];
        const el = document.createElement('div');
        el.className = 'tx-item';
        el.innerHTML = `
            <span class="tx-badge ${tx.type}">${tx.type.toUpperCase()}</span>
            <span class="tx-detail">${tx.quantity} share${tx.quantity === 1 ? '' : 's'} @ $${tx.price.toFixed(2)}</span>
            <span class="tx-time">${tx.timestamp}</span>
        `;
        elTxList.appendChild(el);
    }
}
setInterval(poll, 200);
poll();
updateRegimeButtons();
// ── Responsive iframe scaling ──────────────────────────────────────────────
function scaleChartPreview() {
    const wrapper = document.querySelector('.iframe-wrapper');
    const iframe = wrapper?.querySelector('iframe');
    if (!wrapper || !iframe)
        return;
    const scale = wrapper.clientWidth / 1200;
    iframe.style.transform = `scale(${scale})`;
    wrapper.style.height = `${Math.round(700 * scale)}px`;
}
window.addEventListener('resize', scaleChartPreview);
setTimeout(scaleChartPreview, 0);
// ── Screen activation ──────────────────────────────────────────────────────
function setActivated(btn, label) {
    btn.classList.add('active');
    btn.textContent = label + ' ✓';
    btn.disabled = true;
}
function resetActivateButtons() {
    btnActivateChart.classList.remove('active');
    btnActivateChart.textContent = 'ACTIVATE CHART';
    btnActivateChart.disabled = false;
    btnActivatePortfolio.classList.remove('active');
    btnActivatePortfolio.textContent = 'ACTIVATE PORTFOLIO';
    btnActivatePortfolio.disabled = false;
}
btnActivateChart.addEventListener('click', () => {
    comms.publish('stock-sim-chart-active', 'true');
    setActivated(btnActivateChart, 'CHART ACTIVE');
});
btnActivatePortfolio.addEventListener('click', () => {
    comms.publish('stock-sim-portfolio-active', 'true');
    setActivated(btnActivatePortfolio, 'PORTFOLIO ACTIVE');
});
// Sync button state if controller page refreshes mid-session
comms.subscribe('stock-sim-chart-active', (val) => {
    if (val === 'true')
        setActivated(btnActivateChart, 'CHART ACTIVE');
});
comms.subscribe('stock-sim-portfolio-active', (val) => {
    if (val === 'true')
        setActivated(btnActivatePortfolio, 'PORTFOLIO ACTIVE');
});
// ── Connection status + client count ──────────────────────────────────────
comms.subscribe('__clients__', (payload) => {
    const count = parseInt(payload, 10);
    elClientCount.textContent = `${count} device${count !== 1 ? 's' : ''}`;
    elConnDot.className = 'conn-dot ' + (count > 1 ? 'live' : '');
    elConnText.textContent = count > 1 ? `${count} connected` : 'Waiting for devices...';
});
// ── Reset simulation ───────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
    comms.publish('stock-sim-reset', JSON.stringify({ at: Date.now() }));
    // Wipe stale values from the local cache so poll() doesn't immediately
    // re-apply old data before the reloaded pages publish fresh state.
    comms.clearTopics('stock-sim-price', 'stock-sim-portfolio', 'stock-sim-regime', 'stock-sim-chart-active', 'stock-sim-portfolio-active');
    comms.publish('stock-sim-chart-active', 'false');
    comms.publish('stock-sim-portfolio-active', 'false');
    resetActivateButtons();
    // Reset all controller state variables
    currentPrice = 0;
    startPrice = 0;
    priceReceived = false;
    // Reset every display element to its default value right now
    elStatus.textContent = 'Waiting for market...';
    elStatus.classList.remove('live');
    elPrice.textContent = '--';
    elChange.textContent = '--';
    elChange.className = 'info-value';
    elRegimeTime.textContent = '--';
    elCash.textContent = '$50.00';
    elShares.textContent = '10';
    elMktVal.textContent = '$0.00';
    elPnl.textContent = '$0.00';
    elPnl.className = 'info-value';
    elTxCount.textContent = '0';
    lastTxCount = 0;
    elTxList.innerHTML = '<div class="tx-empty">No transactions yet</div>';
    applyRegime('normal');
});
