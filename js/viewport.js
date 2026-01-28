export class ViewportManager {
    constructor(config) {
        // Timeline viewport (which candles are visible)
        this.startCandleIndex = 0;
        this.endCandleIndex = 70;
        // Price viewport (vertical zoom)
        this.priceZoomFactor = 1.0;
        this.minVisibleCandles = 30;
        this.maxVisibleCandles = 150;
        // Auto-scroll state
        this.autoScrollEnabled = true;
        this.totalCandles = config.totalCandles;
        this.minVisibleCandles = config.minVisibleCandles;
        this.maxVisibleCandles = config.maxVisibleCandles;
        // Initialize viewport to show first N candles
        const visibleCount = Math.min(config.defaultVisibleCandles, config.totalCandles);
        this.startCandleIndex = 0;
        this.endCandleIndex = visibleCount;
    }
    panTimeline(deltaCandles) {
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
    setTimelineZoom(candleCount) {
        // Clamp to bounds (30-150 candles)
        const clampedCount = Math.max(this.minVisibleCandles, Math.min(this.maxVisibleCandles, candleCount));
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
    setPriceZoom(factor) {
        this.priceZoomFactor = Math.max(0.5, Math.min(5.0, factor));
    }
    updateForNewCandle(newTotalCandles) {
        this.totalCandles = newTotalCandles;
        if (this.autoScrollEnabled) {
            // Keep viewport at trailing edge (show most recent candles)
            const visibleCount = this.getVisibleCandleCount();
            this.endCandleIndex = newTotalCandles;
            this.startCandleIndex = Math.max(0, newTotalCandles - visibleCount);
        }
        // If auto-scroll disabled, viewport stays at current position
    }
    disableAutoScroll() {
        this.autoScrollEnabled = false;
    }
    enableAutoScroll() {
        this.autoScrollEnabled = true;
    }
    setTotalCandles(totalCandles) {
        this.totalCandles = totalCandles;
        // Ensure current viewport is still valid
        if (this.endCandleIndex > totalCandles) {
            this.endCandleIndex = totalCandles;
            this.startCandleIndex = Math.max(0, totalCandles - this.getVisibleCandleCount());
        }
    }
    // --- Getters ---
    getVisibleCandleCount() {
        return this.endCandleIndex - this.startCandleIndex;
    }
    getViewportRange() {
        return {
            start: this.startCandleIndex,
            end: this.endCandleIndex
        };
    }
    getPriceZoomFactor() {
        return this.priceZoomFactor;
    }
    isAutoScrollEnabled() {
        return this.autoScrollEnabled;
    }
    getTotalCandles() {
        return this.totalCandles;
    }
    /**
     * Check if viewport is at the trailing edge (viewing the most recent candles).
     * Used to determine if auto-scroll should be re-enabled.
     */
    isAtTrailingEdge() {
        return this.endCandleIndex >= this.totalCandles;
    }
}
