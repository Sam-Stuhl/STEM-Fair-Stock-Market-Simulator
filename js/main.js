import { ChartAnimator } from './animator.js';
import { loadCandles, drawChart } from './chart.js';
import { ViewportManager } from './viewport.js';
import { InteractionManager } from './interactions.js';
// Initialization and main event loop for chart view (index.html)
const SYMBOL = "UOPP";
const PRICE_INTERVAL = 5;
const DATE_INTERVAL = 10; // Changed from 10 to 5 - show date labels every 5 candles
let currentCandles = [];
let animator = null;
let viewport = null;
let interactionManager = null;
async function initializeChart() {
    try {
        console.log('Initializing chart...');
        // Load the data
        currentCandles = await loadCandles(SYMBOL);
        console.log(`Loaded ${currentCandles.length} candles for ${SYMBOL}`);
        viewport = new ViewportManager({
            totalCandles: currentCandles.length,
            defaultVisibleCandles: 70,
            minVisibleCandles: 30,
            maxVisibleCandles: 150
        });
        console.log('Viewport initialized:', viewport.getViewportRange());
        setTimeout(() => {
            // Initialize animator
            animator = new ChartAnimator(currentCandles, PRICE_INTERVAL, DATE_INTERVAL);
            console.log('ChartAnimator created');
            // Connect viewport to animator
            if (viewport) {
                animator.setViewport(viewport);
                console.log('Viewport connected to animator');
            }
            const canvas = document.getElementById('chartCanvas');
            if (canvas && viewport) {
                interactionManager = new InteractionManager(canvas, viewport, () => {
                    // Redraw callback: when viewport changes due to user interaction 
                    if (animator && viewport) {
                        const visibleCandles = animator.getVisibleCandles();
                        drawChart(visibleCandles, PRICE_INTERVAL, DATE_INTERVAL, viewport);
                    }
                });
                console.log('InteractionManager initialized');
            }
            // Update header
            const symbolEl = document.getElementById('symbol');
            if (symbolEl) {
                symbolEl.textContent = SYMBOL;
                console.log(`Symbol header updated to: ${SYMBOL}`);
            }
            else {
                console.error('Could not find element with id "symbol"');
            }
            // Start animation automatically
            console.log('Starting animation...');
            animator.play();
        }, 500);
    }
    catch (error) {
        console.error('Error initializing chart:', error);
    }
}
function redrawChart() {
    // Draw the chart
    drawChart(currentCandles, PRICE_INTERVAL, DATE_INTERVAL, viewport ?? undefined);
}
// Handle window resize and zoom events
window.addEventListener('resize', redrawChart);
window.addEventListener('orientationchange', redrawChart);
// Also listen for zoom changes (works in most browsers)
let lastZoom = window.devicePixelRatio;
setInterval(() => {
    if (window.devicePixelRatio !== lastZoom) {
        lastZoom = window.devicePixelRatio;
        redrawChart();
    }
}, 100);
initializeChart();
