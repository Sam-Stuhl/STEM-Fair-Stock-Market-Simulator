// Canvas rendering logic for candlestick chart
// Handles drawing candles, axes, labels, etc.
// --- Constants - TradingView Dark Theme ---
const UP_COLOR = "#26a69a"; // teal green (TradingView style)
const DOWN_COLOR = "#ef5350"; // red
const CHART_PADDING = 20;
const MAX_MIN_PADDING = 5;
// Canvas layout configuration
const PRICE_AXIS_WIDTH = 80;
const DATE_AXIS_HEIGHT = 60;
const PADDING = 10;
const LABEL_PADDING = 10;
// Colors for labels and grid - TradingView inspired
const GRID_COLOR = "#2a2e39";
const AXIS_BORDER_COLOR = "#2a2e39";
const LABEL_COLOR = "#787b86";
const LABEL_FONT = "11px -apple-system, BlinkMacSystemFont, 'Trebuchet MS', 'Segoe UI', sans-serif";
// Calculate the three regions of the canvas
export function getCanvasRegions(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    return {
        chartArea: {
            x: 0,
            y: 0,
            width: width - PRICE_AXIS_WIDTH,
            height: height - DATE_AXIS_HEIGHT,
        },
        priceAxis: {
            x: width - PRICE_AXIS_WIDTH,
            y: 0,
            width: PRICE_AXIS_WIDTH,
            height: height - DATE_AXIS_HEIGHT
        },
        dateAxis: {
            x: 0,
            y: height - DATE_AXIS_HEIGHT,
            width: width - PRICE_AXIS_WIDTH,
            height: DATE_AXIS_HEIGHT
        }
    };
}
// Detect which region of the canvas a mouse position is in
export function detectCanvasRegion(canvas, mouseX, mouseY) {
    const regions = getCanvasRegions(canvas);
    // Check price axis (right side)
    if (mouseX >= regions.priceAxis.x &&
        mouseX <= regions.priceAxis.x + regions.priceAxis.width &&
        mouseY >= regions.priceAxis.y &&
        mouseY <= regions.priceAxis.y + regions.priceAxis.height) {
        return 'priceAxis';
    }
    // Check date axis (bottom)
    if (mouseX >= regions.dateAxis.x &&
        mouseX <= regions.dateAxis.x + regions.dateAxis.width &&
        mouseY >= regions.dateAxis.y &&
        mouseY <= regions.dateAxis.y + regions.dateAxis.height) {
        return 'dateAxis';
    }
    // Check chart area (main candle area)
    if (mouseX >= regions.chartArea.x &&
        mouseX <= regions.chartArea.x + regions.chartArea.width &&
        mouseY >= regions.chartArea.y &&
        mouseY <= regions.chartArea.y + regions.chartArea.height) {
        return 'chartArea';
    }
    // Mouse is outside all regions (shouldn't happen often)
    return null;
}
// Draw price labels and horizontal grid lines on canvas
function drawPriceLabelsOnCanvas(ctx, regions, priceLabels, minPrice, maxPrice) {
    const { priceAxis, chartArea } = regions;
    ctx.save();
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = LABEL_FONT;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    priceLabels.forEach((price, index) => {
        // Skip the last price label (highest) to avoid cutoff at top
        if (index === priceLabels.length - 1)
            return;
        // Calculate Y position within chart area
        const yInChart = getPixelY(maxPrice, minPrice, price, chartArea.height);
        // Draw horizontal grid lines across chart area 
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(chartArea.x, yInChart);
        ctx.lineTo(chartArea.x + chartArea.width, yInChart);
        ctx.stroke();
        // Draw price label in price axis region
        const labelText = `$${Math.round(price)}`;
        const labelX = priceAxis.x + LABEL_PADDING;
        const labelY = yInChart;
        ctx.fillText(labelText, labelX, labelY);
    });
    ctx.restore();
}
// Draw date labels and vertical grid lines on canvas
function drawDateLabelsOnCanvas(ctx, regions, dateLabels, totalCandles) {
    const { dateAxis, chartArea } = regions;
    const candleWidth = chartArea.width / totalCandles;
    ctx.save();
    ctx.fillStyle = LABEL_COLOR;
    ctx.font = LABEL_FONT;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    dateLabels.forEach(d => {
        // Calculate X position within chart area - CENTER the label on the candle
        const xInChart = getPixelX(candleWidth, d.candleNum) + candleWidth / 2;
        // Measure label width to check if it would be cut off
        const labelWidth = ctx.measureText(d.date).width;
        const labelHalfWidth = labelWidth / 2;
        // Skip labels that would be cut off at the edges
        if (xInChart - labelHalfWidth < 5 || xInChart + labelHalfWidth > chartArea.width - 5) {
            return; // Skip this label
        }
        // Draw vertical grid line across chart area
        ctx.strokeStyle = GRID_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xInChart, chartArea.y);
        ctx.lineTo(xInChart, chartArea.y + chartArea.height);
        ctx.stroke();
        // Draw date label in date axis region (centered on candle)
        const labelX = xInChart;
        const labelY = dateAxis.y + LABEL_PADDING;
        ctx.fillText(d.date, labelX, labelY);
    });
    ctx.restore();
}
function getPixelY(maxPrice, minPrice, currentPrice, canvasHeight) {
    return (maxPrice - currentPrice) / (maxPrice - minPrice) * canvasHeight;
}
function getPixelX(candleWidth, currentCandleNum) {
    return candleWidth * currentCandleNum;
}
export async function loadCandles(symbol) {
    try {
        console.log(`Loading candles for ${symbol} from ../assets/${symbol}.json`);
        const response = await fetch(`../assets/${symbol}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`Loaded ${data.candles.length} candles successfully`);
        return data.candles;
    }
    catch (error) {
        console.error('Error loading candles:', error);
        throw error;
    }
}
export function drawChart(candles, priceInterval, dateInterval, viewport) {
    const canvas = document.getElementById('chartCanvas');
    const ctx = canvas.getContext('2d');
    const regions = getCanvasRegions(canvas);
    // Slice to viewport window if provided
    let visibleCandles = candles;
    if (viewport) {
        const range = viewport.getViewportRange();
        const effectiveStart = Math.max(0, range.start);
        const effectiveEnd = Math.min(candles.length, range.end);
        visibleCandles = candles.slice(effectiveStart, effectiveEnd);
    }
    // clear canvas - TradingView dark background
    ctx.fillStyle = "#131722";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // get min and max
    const [minPrice, maxPrice] = _getMinMax(visibleCandles, MAX_MIN_PADDING);
    // Handle empty candles array
    if (visibleCandles.length === 0) {
        return;
    }
    const candleWidth = regions.chartArea.width / visibleCandles.length;
    const priceLabels = _getPriceLabels(visibleCandles, priceInterval, minPrice, maxPrice);
    const dateLabels = _getDateLabels(visibleCandles, dateInterval);
    drawPriceLabelsOnCanvas(ctx, regions, priceLabels, minPrice, maxPrice);
    drawDateLabelsOnCanvas(ctx, regions, dateLabels, visibleCandles.length);
    // Draw separator lines between chart and axes
    ctx.strokeStyle = AXIS_BORDER_COLOR;
    ctx.lineWidth = 1;
    // Vertical separator (between chart and price axis)
    ctx.beginPath();
    ctx.moveTo(regions.priceAxis.x, 0);
    ctx.lineTo(regions.priceAxis.x, regions.chartArea.height);
    ctx.stroke();
    // Horizontal separator (between chart and date axis)
    ctx.beginPath();
    ctx.moveTo(0, regions.dateAxis.y);
    ctx.lineTo(regions.chartArea.width, regions.dateAxis.y);
    ctx.stroke();
    // -- draw candles --
    for (let i = 0; i < visibleCandles.length; i++) {
        const candle = visibleCandles[i];
        const isUp = candle.close >= candle.open;
        const color = isUp ? UP_COLOR : DOWN_COLOR;
        // Calculate positions - now using chartArea dimensions
        const x = regions.chartArea.x + getPixelX(candleWidth, i); // Offset by chartArea.x
        const highY = getPixelY(maxPrice, minPrice, candle.high, regions.chartArea.height);
        const lowY = getPixelY(maxPrice, minPrice, candle.low, regions.chartArea.height);
        const openY = getPixelY(maxPrice, minPrice, candle.open, regions.chartArea.height);
        const closeY = getPixelY(maxPrice, minPrice, candle.close, regions.chartArea.height);
        // Draw wick (thicker for better visibility)
        const centerX = x + candleWidth / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(centerX, highY);
        ctx.lineTo(centerX, lowY);
        ctx.stroke();
        // Draw body (wider with minimum height)
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(openY - closeY), 2); // Minimum 2px height
        const bodyWidth = candleWidth * 0.8; // Use 80% of available width
        const bodyX = x + (candleWidth - bodyWidth) / 2; // Center the body
        ctx.fillStyle = color;
        ctx.fillRect(bodyX, bodyTop, bodyWidth, bodyHeight);
    }
    const latestCandle = visibleCandles[visibleCandles.length - 1];
    const isUpFinal = latestCandle.close >= latestCandle.open;
    const priceEl = document.getElementById("current_price");
    if (priceEl) {
        priceEl.style.color = isUpFinal ? UP_COLOR : DOWN_COLOR;
    }
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
