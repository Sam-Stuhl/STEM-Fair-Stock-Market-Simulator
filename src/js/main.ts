import { ChartAnimator } from './animator.js';
import { drawChart } from './chart.js';
import { ViewportManager } from './viewport.js';
import { InteractionManager } from './interactions.js';
import { MarketRegime } from './priceGenerator.js';
import { comms } from './comms.js';

const isPreview = window.self !== window.top;
comms.connect();

const SYMBOL = "WILD";
const DATE_INTERVAL = 10;

let animator: ChartAnimator | null = null;
let viewport: ViewportManager | null = null;

function initializeChart(): void {
    viewport = new ViewportManager({
        totalCandles: 70,
        defaultVisibleCandles: 70,
        minVisibleCandles: 30,
        maxVisibleCandles: 150
    });

    // No historical data — animator seeds the first candle from scratch
    animator = new ChartAnimator([], DATE_INTERVAL);
    animator.setViewport(viewport);

    const canvas = document.getElementById('chartCanvas') as HTMLCanvasElement;
    if (canvas && viewport) {
        new InteractionManager(canvas, viewport, () => {
            if (animator && viewport) {
                drawChart(animator.getVisibleCandles(), DATE_INTERVAL, viewport);
            }
        });
    }

    const symbolEl = document.getElementById('symbol');
    if (symbolEl) symbolEl.textContent = SYMBOL;

    // Broadcast price + candle snapshot so portfolio/controller/previews stay in sync.
    let lastWrite = 0;
    animator.onPriceUpdate = (price: number) => {
        if (isPreview) return;
        const now = performance.now();
        if (now - lastWrite > 100) {
            lastWrite = now;
            comms.publish('stock-sim-price', String(price));
            // Publish slim candle snapshot for the controller's preview iframe
            const visible = animator!.getVisibleCandles();
            const slim = visible.map(c => ({ open: c.open, high: c.high, low: c.low, close: c.close, date: c.date }));
            comms.publish('stock-sim-candles', JSON.stringify(slim));
        }
    };

    animator.play();
}

function redrawChart(): void {
    if (animator && viewport) {
        drawChart(animator.getVisibleCandles(), DATE_INTERVAL, viewport);
    }
}

window.addEventListener('resize', redrawChart);
window.addEventListener('orientationchange', redrawChart);

let lastZoom = window.devicePixelRatio;
setInterval(() => {
    if (window.devicePixelRatio !== lastZoom) {
        lastZoom = window.devicePixelRatio;
        redrawChart();
    }
}, 100);

// React to regime changes from the controller (WebSocket push + localStorage fallback poll)
let lastAppliedRegime: MarketRegime = 'normal';

function applyRegimeChange(raw: string): void {
    if (!animator) return;
    try {
        const data = JSON.parse(raw) as { regime: MarketRegime };
        if (data.regime && data.regime !== lastAppliedRegime) {
            lastAppliedRegime = data.regime;
            animator.setRegime(data.regime);
        }
    } catch { /* ignore */ }
}

comms.subscribe('stock-sim-regime', applyRegimeChange);

setInterval(() => {
    const raw = comms.getLatest('stock-sim-regime');
    if (raw) applyRegimeChange(raw);
}, 200);

comms.subscribe('stock-sim-reset', () => window.location.reload());

if (isPreview) {
    // Preview mode: mirror the real chart — no landing screen, no animator.
    document.getElementById('landing-overlay')?.remove();

    comms.subscribe('stock-sim-candles', (raw) => {
        try {
            const candles = JSON.parse(raw);
            drawChart(candles, DATE_INTERVAL);
        } catch { /* ignore malformed */ }
    });

    const priceEl = document.getElementById('current_price');
    comms.subscribe('stock-sim-price', (raw) => {
        const p = parseFloat(raw);
        if (priceEl && isFinite(p)) priceEl.textContent = '$' + p.toFixed(2);
    });
} else {
    // Keyboard fallback for regime changes
    window.addEventListener('keydown', (e: KeyboardEvent) => {
        if (!animator) return;
        const map: Partial<Record<string, MarketRegime>> = { b: 'bull', r: 'bear', n: 'normal' };
        const regime = map[e.key.toLowerCase()];
        if (!regime) return;
        lastAppliedRegime = regime;
        animator.setRegime(regime);
        comms.publish('stock-sim-regime', JSON.stringify({ regime, since: Date.now() }));
    });

    let chartStarted = false;
    function activateChart(): void {
        if (chartStarted) return;
        chartStarted = true;
        const overlay = document.getElementById('landing-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        }
        initializeChart();
    }

    comms.subscribe('stock-sim-chart-active', (val) => {
        if (val === 'true') activateChart();
    });
}
