// Canvas rendering logic for candlestick chart
// Handles drawing candles, axes, labels, etc.

// --- Constants ---
const UP_COLOR = "#22c55e" // green
const DOWN_COLOR = "#ef4444" // red
const CHART_PADDING = 20

function getPixelY(maxPrice: number, minPrice: number, currentPrice: number, canvasHeight: number) : number {
    return (maxPrice - currentPrice) / (maxPrice - minPrice) * canvasHeight;
}

function getPixelX(candleWidth: number, currentCandleNum: number) : number {
    return candleWidth * currentCandleNum;
}

async function loadCandles(symbol: string) : Promise<Candle[]> {
    const response = await fetch(`../assets/${symbol}.json`);
    const data = await response.json();

    return data.candles;
} 

function drawChart(candles: Candle[]) {
    const canvas = document.getElementById('chartCanvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

    const candleWidth = (canvas.width / candles.length) * 0.8;

    // clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // find min and max
    let min = Infinity;
    let max = -Infinity;

    candles.forEach(candle => {
        if (candle.high && candle.high > max) {
            max = candle.high;
        } else if (candle.low && candle.low < min) {
            min = candle.low;
        }
    });

    min -= 5; // padding
    max += 5; // padding


    // draw candles
    for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const strokeStyle = candle.open > candle.close ? UP_COLOR : DOWN_COLOR;

        // get positions
        const pixelX = getPixelX(candleWidth, i);
        const pixelYHigh = getPixelY(max, min, candle.high, canvas.height);
        const pixelYLow = getPixelY(max, min, candle.low, canvas.height);
        const pixelYOpen = getPixelY(max, min, candle.open, canvas.height);
        const pixelYClose = getPixelY(max, min, candle.close, canvas.height);

        // draw wick
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pixelX + candleWidth, pixelYHigh);
        ctx.lineTo(pixelX + candleWidth, pixelYLow);
        ctx.stroke();

        // draw body
        const bodyTop = Math.min(pixelYOpen, pixelYClose);
        const bodyHeight = Math.abs(pixelYOpen - pixelYClose);

        ctx.fillStyle = strokeStyle;
        ctx.fillRect(pixelX + (candleWidth / 2), bodyTop, candleWidth, bodyHeight);

    }


}