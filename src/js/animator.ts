import { Candle } from './types.js';
import { drawChart } from './chart.js';
import { ViewportManager } from './viewport.js';
import { generateCandle, nextBusinessDate, MarketRegime, setRegime } from './priceGenerator.js';

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
    private dateInterval: number;

    // Viewport reference
    private viewport: ViewportManager | null = null;

    // Optional callback fired each time the displayed price changes
    public onPriceUpdate: ((price: number) => void) | null = null;

    constructor(candles: Candle[], dateInterval: number) {
        this.candles = candles;
        this.dateInterval = dateInterval;

        if (this.candles.length === 0) {
            // Fresh start — seed the very first candle from a fixed starting price
            this.candles.push(generateCandle(10, '2025-01-02'));
            this.currentCandleIndex = 0;
        } else {
            // Continue from end of any pre-loaded data
            this.generateAndAppendNextCandle();
            this.currentCandleIndex = this.candles.length - 1;
        }
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

    public setRegime(regime: MarketRegime): void {
        setRegime(regime);
    }

    private generateAndAppendNextCandle(): void {
        const last = this.candles[this.candles.length - 1];
        const nextPrice = last.price_path[last.price_path.length - 1];
        const nextDate = nextBusinessDate(last.date);
        this.candles.push(generateCandle(nextPrice, nextDate));
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
        drawChart(visibleCandles, this.dateInterval, this.viewport ?? undefined);

        if (visibleCandles.length > 0) {
            this.updateHeaderPrice(visibleCandles[visibleCandles.length - 1].open, visibleCandles[visibleCandles.length - 1].close);
        }
        
        if (this.currentCandleIndex % 5 === 0 && this.candleProgress < 0.05) {
            console.log(`Rendering candle ${this.currentCandleIndex + 1} of ${this.candles.length}`);
        }

        // Move to next candle when current one completes
        if (this.candleProgress >= 1.0) {
            this.currentCandleIndex++;
            this.candleProgress = 0;

            // Generate the next candle. Regime changes take effect here.
            if (this.currentCandleIndex >= this.candles.length) {
                this.generateAndAppendNextCandle();
            }

            // Always keep viewport tracking the live edge
            if (this.viewport) {
                this.viewport.updateForNewCandle(this.candles.length);
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
            const isUp = price >= candleOpen;
            priceEl.style.color = isUp ? "#26a69a" : "#ef5350";
        }
        if (this.onPriceUpdate) this.onPriceUpdate(price);
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

