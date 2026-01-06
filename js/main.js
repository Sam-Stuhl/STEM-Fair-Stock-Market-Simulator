"use strict";
// Initialization and main event loop for chart view (index.html)
const SYMBOL = "WJES";
const PRICE_INTERVAL = 5;
const DATE_INTERVAL = 10;
let currentCandles = [];
async function initializeChart() {
    // Load the data
    currentCandles = await loadCandles(SYMBOL);
    if (currentCandles.length > 0) {
        testInterpolation(currentCandles[0]);
    }
    // Wait for the browser to finish layout before drawing
    setTimeout(() => {
        // Draw everything
        redrawChart();
        // Update the header
        document.getElementById('symbol').textContent = SYMBOL;
        document.getElementById('current_price').textContent = '$' + currentCandles[currentCandles.length - 1].close.toFixed(2);
    }, 500);
}
function redrawChart() {
    // Draw the chart
    drawChart(currentCandles, PRICE_INTERVAL, DATE_INTERVAL);
    // Draw the price axis
    drawPriceAxis(currentCandles, PRICE_INTERVAL);
    // Draw the date axis
    drawDateAxis(currentCandles, DATE_INTERVAL);
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
