import { Candle } from './types.js';
import { drawChart } from './chart.js';
import { ViewportManager } from './viewport.js';

export class ChartAnimator {
    // Core animation state
    private candles: Candle[];
    private currentCandleIndex: number = 0;
    private candleProgress: number = 0;
    private isPlaying: boolean = false;

    // Timing controls
    private animationSpeed: number = 1.0;
    private millisecondsPerCandle: number = 1000;  // Changed from 1000 to 2000 (2 seconds per candle)
    private lastTimestamp: number = 0;

    // Rendering configuration
    private priceInterval: number;
    private dateInterval: number;

    // Viewport reference
    private viewport: ViewportManager | null = null;

    constructor(candles: Candle[], priceInterval: number, dateInterval: number) {
        this.candles = candles;
        this.priceInterval = priceInterval;
        this.dateInterval = dateInterval;
    }

    public setViewport(viewport: ViewportManager): void {
        this.viewport = viewport;
    }

    public getState() {
        return {
            currentCandleIndex: this.currentCandleIndex,
            candleProgress: this.candleProgress,
            isPlaying: this.isPlaying,
            totalCandles: this.candles.length
        };
    }

    public play(): void {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.lastTimestamp = 0;

        // Start the animation loop
        requestAnimationFrame((ts) => this.animate(ts));
    }

    public pause(): void {
        this.isPlaying = false;
    }

    private animate(timestamp: number): void {
        if (!this.isPlaying) return;

        // Calculate delta time (how much time passed since last frame)
        const deltaTime = this.lastTimestamp === 0 ? 0: timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        // Update progress based on time and speed
        const progressIncrement = (deltaTime / this.millisecondsPerCandle) * this.animationSpeed;
        this.candleProgress += progressIncrement;

        const visibleCandles = this.getVisibleCandles();
        drawChart(visibleCandles, this.priceInterval, this.dateInterval, this.viewport ?? undefined);

        if (visibleCandles.length > 0) {
            this.updateHeaderPrice(visibleCandles[visibleCandles.length - 1].open, visibleCandles[visibleCandles.length - 1].close);
        }
        
        if (this.currentCandleIndex % 5 === 0 && this.candleProgress < 0.05) {
            console.log(`Rendering candle ${this.currentCandleIndex + 1} of ${this.candles.length}`);
        }

        // Move to next candle whe current one completes
        if (this.candleProgress >= 1.0) {
            this.currentCandleIndex++;
            this.candleProgress = 0;

            // Update viewport to follow animation (auto-scroll)
            if (this.viewport && this.currentCandleIndex + 1 > 70) {
                this.viewport.updateForNewCandle(this.currentCandleIndex + 1);
            }

            console.log(`Moving to candle ${this.currentCandleIndex}`);

            // Stop if animation complete
            if (this.currentCandleIndex >= this.candles.length) {
                console.log('Animation complete!');
                this.isPlaying = false;
                this.currentCandleIndex = this.candles.length - 1;
                this.candleProgress = 1.0;
                return;
            }
        }

        // Schedule next frame (this creates the loop!)
        requestAnimationFrame((ts) => this.animate(ts));
    }

    public getVisibleCandles(): Candle[] {
        const visible: Candle[] = [];

        // Add all complete candles (fully formed)
        for (let i = 0; i < this.currentCandleIndex; i++) {
            visible.push(this.candles[i])
        }

        // Add currently animating candle (partially formed)
        if (this.currentCandleIndex < this.candles.length) {
            const interpolated = interpolateCandle(
                this.candles[this.currentCandleIndex],
                this.candleProgress
            );
            visible.push(interpolated);
        }

        return visible;
    }

    private updateHeaderPrice(candleOpen: number, price: number): void {
        const priceEl = document.getElementById("current_price");
        if (priceEl) {
            priceEl.textContent = '$' + price.toFixed(2);
            // Color based on first candle vs current price - TradingView colors
            const isUp = price >= candleOpen;
            priceEl.style.color = isUp ? "#26a69a" : "#ef5350";
        }
    }
}



// Linear interpolation: smoothly blend from start to end based on progress
function lerp(start: number, end: number, progress: number) {
    return start + (end - start) * progress;
}

// Smoothly animate through a candle's price path
function interpolateCandle(
    targetCandle: Candle,
    progress: number
): Candle {
    const path = targetCandle.price_path;

    // Convert progress (0.0 to 1.0) into an array index (0.0 to 19.0 w/ a path of length 20)
    const exactIndex = progress * (path.length - 1)

    //Find two points to interpolate between
    const lowerIndex = Math.floor(exactIndex);
    const upperIndex = Math.ceil(exactIndex);

    // How far between the two points?
    const fraction = exactIndex - lowerIndex;

    // Get the current price by lerping between two points in the path
    const currentPrice = lerp(path[lowerIndex], path[upperIndex], fraction);
    
    // Calculate high and low up to this point in the animation
    const visiblePath = path.slice(0, upperIndex + 1);
    const highSoFar = Math.max(...visiblePath);
    const lowSoFar = Math.min(...visiblePath);

    return {
        open: path[0],
        high: highSoFar,
        low: lowSoFar,
        close: currentPrice,
        date: targetCandle.date,
        isInEvent: targetCandle.isInEvent,
        price_path: targetCandle.price_path
    }
}

function testInterpolation(candle: Candle): void {
    console.log('=== Testing Interpolation ===');
    console.log('Original candle:', {
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close
    });

    console.log('\nInterpolating at different progress values:');

    // Test at 0%, 25%, 50%, 75%, 100%
    [0.0, 0.25, 0.5, 0.75, 1.0].forEach(progress => {
        const interpolated = interpolateCandle(candle, progress);
        console.log(`  ${(progress * 100).toFixed(0)}%: open=${interpolated.open.toFixed(2)}, high=${interpolated.high.toFixed(2)}, low=${interpolated.low.toFixed(2)}`)
    })
}