export class ViewportManager {
    // Timeline viewport (which candles are visible)
    private startCandleIndex: number = 0;
    private endCandleIndex: number = 70;

    // Price viewport (vertical zoom)
    private priceZoomFactor: number = 1.0;

    // Constraints
    private totalCandles: number;
    private defaultVisibleCandles: number = 70;
    private minVisibleCandles: number = 30;
    private maxVisibleCandles: number = 150;

    // Auto-scroll state
    private autoScrollEnabled: boolean = true;

    constructor (config: {
        totalCandles: number;
        defaultVisibleCandles: number;
        minVisibleCandles: number;
        maxVisibleCandles: number;
    }) {
        this.totalCandles = config.totalCandles;
        this.defaultVisibleCandles = config.defaultVisibleCandles;
        this.minVisibleCandles = config.minVisibleCandles;
        this.maxVisibleCandles = config.maxVisibleCandles;

        // Initialize viewport to show first N candles
        const visibleCount = Math.min(config.defaultVisibleCandles, config.totalCandles);
        this.startCandleIndex = 0;
        this.endCandleIndex = visibleCount;
    }


    public panTimeline(deltaCandles: number): void {
        let newStart = this.startCandleIndex + deltaCandles;
        let newEnd = this.endCandleIndex + deltaCandles;

        // Clamp to bounds [0, totalCandles]
        if (newStart < 0) {
            newStart = 0;
            newEnd = this.getVisibleCandleCount();
        }
        if (newEnd > this.totalCandles) {
            newEnd = this.totalCandles;
            newStart = newEnd - this.getVisibleCandleCount();
        }

        this.startCandleIndex = Math.max(0, newStart);
        this.endCandleIndex = Math.min(this.totalCandles, newEnd);
    }

    public setTimelineZoom(candleCount: number): void {
        // Clamp to bounds (30-150 candles)
        const clampedCount = Math.max(
            this.minVisibleCandles,
            Math.min(this.maxVisibleCandles, candleCount)
        );

        // Calculate current center point
        const currentCenter = (this.startCandleIndex + this.endCandleIndex) / 2;

        // Calculate new range around that center
        let newStart = Math.round(currentCenter - clampedCount / 2);
        let newEnd = Math.round(currentCenter + clampedCount / 2);

        // Clamp to data bounds [0, totalCandles]
        if (newStart < 0) {
            newStart = 0;
            newEnd = clampedCount;
        }
        if (newEnd > this.totalCandles) {
            newEnd = this.totalCandles;
            newStart = Math.max(0, newEnd - clampedCount);
        }

        this.startCandleIndex = newStart;
        this.endCandleIndex = newEnd;
    }

    public setPriceZoom(factor: number): void {
        this.priceZoomFactor = Math.max(0.5, Math.min(5.0, factor));
    }

    public updateForNewCandle(newTotalCandles: number): void {
        this.totalCandles = newTotalCandles;

        if (this.autoScrollEnabled) {
            // Grow window up to defaultVisibleCandles, then hold at that size
            const desiredCount = Math.min(newTotalCandles, this.defaultVisibleCandles);
            this.endCandleIndex = newTotalCandles;
            this.startCandleIndex = Math.max(0, newTotalCandles - desiredCount);
        }
    }

    public disableAutoScroll(): void {
        this.autoScrollEnabled = false;
    }

    public enableAutoScroll(): void {
        this.autoScrollEnabled = true;
    }

    public setTotalCandles(totalCandles: number): void {
        this.totalCandles = totalCandles;

        // Ensure current viewport is still valid
        if (this.endCandleIndex > totalCandles) {
            this.endCandleIndex = totalCandles;
            this.startCandleIndex = Math.max(0, totalCandles - this.getVisibleCandleCount());
        }
    }


    // --- Getters ---

    public getVisibleCandleCount(): number {
        return this.endCandleIndex - this.startCandleIndex;
    }

    // The intended number of candle slots to render into — stable even while
    // the chart is still filling up. Use this for candle width calculations.
    public getDefaultVisibleCount(): number {
        return this.defaultVisibleCandles;
    }

    public getViewportRange(): { start: number; end: number } {
        return {
            start: this.startCandleIndex,
            end: this.endCandleIndex
        }
    }

    public getPriceZoomFactor(): number {
        return this.priceZoomFactor;
    }

    public isAutoScrollEnabled(): boolean {
        return this.autoScrollEnabled;
    }

    public getTotalCandles(): number {
        return this.totalCandles;
    }

    /**
     * Check if viewport is at the trailing edge (viewing the most recent candles).
     * Used to determine if auto-scroll should be re-enabled.
     */
    public isAtTrailingEdge(): boolean {
        return this.endCandleIndex >= this.totalCandles;
    }
}