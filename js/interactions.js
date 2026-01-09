import { detectCanvasRegion, getCanvasRegions } from "./chart";
export class InteractionManager {
    constructor(canvas, viewport, redrawCallback) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.redrawCallback = redrawCallback;
        this.redrawScheduled = false;
        this.dragState = {
            isDragging: false,
            activeRegion: null,
            startX: 0,
            startY: 0,
            lastX: 0,
            lastY: 0
        };
        this.setupEventListeners();
    }
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    }
    onMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const mouseY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
        const region = detectCanvasRegion(this.canvas, mouseX, mouseY);
        if (region) {
            this.dragState.isDragging = true;
            this.dragState.activeRegion = region;
            this.dragState.startX = mouseX;
            this.dragState.startY = mouseY;
            this.dragState.lastX = mouseX;
            this.dragState.lastY = mouseY;
            // Disable auto-scroll if dragging chart area
            if (region === 'chartArea') {
                this.viewport.disableAutoScroll();
            }
            this.updateCursor(region);
        }
    }
    onMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
        const mouseY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
        if (!this.dragState.isDragging) {
            // Update cursor based on hover region
            const region = detectCanvasRegion(this.canvas, mouseX, mouseY);
            this.updateCursor(region);
            return;
        }
        const deltaX = mouseX - this.dragState.lastX;
        const deltaY = mouseY - this.dragState.lastY;
        // Route to appropriate handler
        if (this.dragState.activeRegion === 'chartArea') {
            this.handleChartDrag(deltaX);
        }
        else if (this.dragState.activeRegion === 'dateAxis') {
            this.handleDateAxisDrag(deltaX);
        }
        else if (this.dragState.activeRegion === 'priceAxis') {
            this.handlePriceAxisDrag(deltaY);
        }
        this.dragState.lastX = mouseX;
        this.dragState.lastY = mouseY;
        // Trigger redraw (throttled)
        this.requestRedraw();
    }
    onMouseUp(event) {
        if (this.dragState.isDragging) {
            this.dragState.isDragging = false;
            this.dragState.activeRegion = null;
            // Update cursor back to default or hover state
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const mouseY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            const region = detectCanvasRegion(this.canvas, mouseX, mouseY);
            this.updateCursor(region);
        }
    }
    handleChartDrag(deltaX) {
        const regions = getCanvasRegions(this.canvas);
        const visibleCandles = this.viewport.getVisibleCandleCount();
        const candleWidth = regions.chartArea.width / visibleCandles;
        // Dragging right -> pan left (negative delta)
        const candlesDelta = -Math.round(deltaX / candleWidth);
        if (candlesDelta !== 0) {
            this.viewport.panTimeline(candlesDelta);
        }
    }
    handleDateAxisDrag(deltaX) {
        const regions = getCanvasRegions(this.canvas);
        const sensitivity = 0.5;
        const currentCount = this.viewport.getVisibleCandleCount();
        const zoomFactor = 1 + (deltaX / regions.dateAxis.width) * sensitivity;
        const newCount = Math.round(currentCount * zoomFactor);
        this.viewport.setTimelineZoom(newCount);
    }
    handlePriceAxisDrag(deltaY) {
        const sensitivity = 0.005;
        const zoomDelta = -deltaY * sensitivity;
        const currentZoom = this.viewport.getPriceZoomFactor();
        const newZoom = currentZoom * (1 + zoomDelta);
        // Clamp to reasonable range
        const clampedZoom = Math.max(0.5, Math.min(5.0, newZoom));
        this.viewport.setPriceZoom(clampedZoom);
    }
    updateCursor(region) {
        if (!region) {
            this.canvas.style.cursor = 'default';
        }
        else if (region === 'chartArea') {
            this.canvas.style.cursor = this.dragState.isDragging ? 'grabbing' : 'grab';
        }
        else if (region === 'dateAxis' || region === 'priceAxis') {
            this.canvas.style.cursor = 'ns-resize';
        }
    }
    requestRedraw() {
        if (this.redrawScheduled)
            return;
        this.redrawScheduled = true;
        requestAnimationFrame(() => {
            this.redrawCallback();
            this.redrawScheduled = false;
        });
    }
}
