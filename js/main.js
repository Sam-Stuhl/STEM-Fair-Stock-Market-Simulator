"use strict";
// Initialization and main event loop for chart view (index.html)
const SYMBOL = "CMYX";
async function initializeChart() {
    // Load the data
    const candles = await loadCandles(SYMBOL);
    // Draw the chart
    drawChart(candles);
    // Update the header
    document.getElementById('symbol').textContent = SYMBOL;
    document.getElementById('current_price').textContent = '$' + candles[candles.length - 1].close.toFixed(2);
}
initializeChart();
