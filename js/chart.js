"use strict";
// Canvas rendering logic for candlestick chart
// Handles drawing candles, axes, labels, etc.
// --- Constants ---
const UP_COLOR = "#22c55e"; // green
const DOWN_COLOR = "#ef4444"; // red
const CHART_PADDING = 20;
const MAX_MIN_PADDING = 5;
function getPixelY(maxPrice, minPrice, currentPrice, canvasHeight) {
    return (maxPrice - currentPrice) / (maxPrice - minPrice) * canvasHeight;
}
function getPixelX(candleWidth, currentCandleNum) {
    return candleWidth * currentCandleNum;
}
async function loadCandles(symbol) {
    const response = await fetch(`../assets/${symbol}.json`);
    const data = await response.json();
    return data.candles;
}
function drawChart(candles, priceInterval, dateInterval) {
    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');
    const candleWidth = (canvas.width / candles.length);
    // clear canvas
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // get min and max
    const [min, max] = _getMinMax(candles, MAX_MIN_PADDING);
    // -- draw grid lines --
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1;
    // prices
    const prices = _getPriceLabels(candles, priceInterval, min, max);
    prices.forEach(p => {
        const gridY = getPixelY(max, min, p, canvas.height);
        ctx.beginPath();
        ctx.moveTo(0, gridY);
        ctx.lineTo(canvas.width, gridY);
        ctx.stroke();
    });
    // dates
    const dates = _getDateLabels(candles, dateInterval);
    dates.forEach(d => {
        const pixelX = getPixelX(candleWidth, d.candleNum);
        ctx.beginPath();
        ctx.moveTo(pixelX + (candleWidth / 2), 0);
        ctx.lineTo(pixelX + (candleWidth / 2), canvas.height);
        ctx.stroke();
    });
    // -- draw candles -- 
    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const strokeColor = candle.open < candle.close ? UP_COLOR : DOWN_COLOR;
        // get positions
        const pixelX = getPixelX(candleWidth, i);
        const pixelYHigh = getPixelY(max, min, candle.high, canvas.height);
        const pixelYLow = getPixelY(max, min, candle.low, canvas.height);
        const pixelYOpen = getPixelY(max, min, candle.open, canvas.height);
        const pixelYClose = getPixelY(max, min, candle.close, canvas.height);
        // draw wick
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pixelX + (candleWidth / 2), pixelYHigh);
        ctx.lineTo(pixelX + (candleWidth / 2), pixelYLow);
        ctx.stroke();
        // draw body
        const bodyTop = Math.min(pixelYOpen, pixelYClose);
        const bodyHeight = Math.abs(pixelYOpen - pixelYClose);
        ctx.fillStyle = strokeColor;
        ctx.fillRect(pixelX, bodyTop, candleWidth, bodyHeight);
        // change price color to reflect candle movement
        const price = document.getElementById("current_price");
        price.style.color = strokeColor;
    }
}
function drawPriceAxis(candles, interval) {
    const priceAxis = document.getElementById('price-axis');
    priceAxis.innerHTML = '';
    // get canvas height
    const canvas = document.getElementById('chartCanvas');
    const canvasRect = canvas.getBoundingClientRect();
    const canvasHeight = canvasRect.height;
    const priceAxisRect = priceAxis.getBoundingClientRect();
    const [min, max] = _getMinMax(candles, MAX_MIN_PADDING);
    const prices = _getPriceLabels(candles, interval, min, max);
    console.log("=== PRICE AXIS DEBUG ===");
    console.log("priceAxisRect.height:", priceAxisRect.height);
    console.log("canvasHeight:", canvasHeight);
    console.log("min:", min, "max:", max);
    console.log("prices array:", prices);
    // -- draw labels --
    prices.forEach((p, index) => {
        // Use the actual price axis height, not the canvas height
        const pixelY = getPixelY(max, min, p, priceAxisRect.height);
        console.log(`Price ${index}: $${Math.round(p)} -> pixelY: ${pixelY}`);
        let newDiv = document.createElement('div');
        newDiv.textContent = `$${Math.round(p)}`;
        newDiv.style.position = 'absolute';
        newDiv.style.top = pixelY + 'px';
        newDiv.style.transform = "translateY(-50%)";
        newDiv.style.fontSize = '13px';
        newDiv.style.fontWeight = '500';
        newDiv.style.color = '#e0e7ff';
        priceAxis.append(newDiv);
    });
}
function drawDateAxis(candles, interval) {
    const dateAxis = document.getElementById('date-axis');
    dateAxis.innerHTML = '';
    const canvas = document.getElementById('chartCanvas');
    const dateAxisRect = dateAxis.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    // Calculate scale factor between canvas internal pixels and rendered pixels
    const scaleX = canvasRect.width / canvas.width;
    const scaleY = canvasRect.height / canvas.height;
    // Calculate candle width in rendered pixels
    const renderedCanvasWidth = canvasRect.width;
    const candleWidth = (renderedCanvasWidth / candles.length);
    const dateLabels = _getDateLabels(candles, interval);
    dateLabels.forEach(d => {
        const date = d.date;
        const candleNum = d.candleNum;
        const pixelX = getPixelX(candleWidth, candleNum);
        const newDiv = document.createElement('div');
        newDiv.textContent = date; //+ ": " + candleNum;
        newDiv.style.position = 'absolute';
        newDiv.style.top = '30px';
        newDiv.style.left = pixelX + (candleWidth / 2) + 'px';
        newDiv.style.transform = 'translateX(-20%) rotate(45deg)';
        newDiv.style.transformOrigin = 'center top';
        newDiv.style.fontSize = '13px';
        newDiv.style.fontWeight = '500';
        newDiv.style.color = '#e0e7ff';
        newDiv.style.whiteSpace = 'nowrap';
        dateAxis?.append(newDiv);
    });
}
// --- Helpers ---
function _getMinMax(candles, padding) {
    // find min and max
    let min = Infinity;
    let max = -Infinity;
    candles.forEach(candle => {
        if (candle.high && candle.high > max) {
            max = candle.high;
        }
        else if (candle.low && candle.low < min) {
            min = candle.low;
        }
    });
    min -= padding;
    max += padding;
    return [min, max];
}
function _getPriceLabels(candles, interval, min, max) {
    let startingPrice = candles[0].open;
    let prices = [startingPrice];
    // add prices above the starting price
    let price = startingPrice + interval;
    while (price <= max) {
        prices.push(price);
        price += interval;
    }
    // add prices below the starting price
    price = startingPrice - interval;
    while (price >= min) {
        prices.unshift(price);
        price -= interval;
    }
    return prices;
}
function _getDateLabels(candles, interval) {
    let dateLabels = [];
    for (let i = 0; i < candles.length; i++) {
        if (i % interval == 0) {
            dateLabels.push({ "date": candles[i].date, "candleNum": i });
        }
    }
    return dateLabels;
}
