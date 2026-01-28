import { ViewportManager } from "./viewport.js";
import { detectCanvasRegion, getCanvasRegions } from "./chart.js";

interface DragState {
    isDragging: boolean;
    activeRegion: 'chartArea' | 'priceAxis' | 'dateAxis' | null;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
}

export class InteractionManager {
    private dragState: DragState;
    private redrawScheduled: boolean = false;

    constructor(
        private canvas: HTMLCanvasElement,
        private viewport: ViewportManager,
        private redrawCallback: () => void
    ) {
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

    private setupEventListeners(): void {
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
    }

    private onMouseDown(event: MouseEvent): void {
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

    private onMouseMove(event: MouseEvent): void {
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
        } else if (this.dragState.activeRegion === 'dateAxis') {
            this.handleDateAxisDrag(deltaX);
        } else if (this.dragState.activeRegion === 'priceAxis') {
            this.handlePriceAxisDrag(deltaY);
        }

        this.dragState.lastX = mouseX;
        this.dragState.lastY = mouseY;

        // Trigger redraw (throttled)
        this.requestRedraw();
    }

    private onMouseUp(event: MouseEvent): void {
        if (this.dragState.isDragging) {
            const wasChartDrag = this.dragState.activeRegion === 'chartArea';

            this.dragState.isDragging = false;
            this.dragState.activeRegion = null;

            // Re-enable auto-scroll if user dragged back to the trailing edge
            if (wasChartDrag && this.viewport.isAtTrailingEdge()) {
                this.viewport.enableAutoScroll();
            }

            // Update cursor back to default or hover state
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = (event.clientX - rect.left) * (this.canvas.width / rect.width);
            const mouseY = (event.clientY - rect.top) * (this.canvas.height / rect.height);
            const region = detectCanvasRegion(this.canvas, mouseX, mouseY);
            this.updateCursor(region);
        }
    }

    private handleChartDrag(deltaX: number): void {
        const regions = getCanvasRegions(this.canvas);
        const visibleCandles = this.viewport.getVisibleCandleCount();
        const candleWidth = regions.chartArea.width / visibleCandles;

        // Dragging right -> pan left (negative delta)
        const candlesDelta = -Math.round(deltaX / candleWidth);

        if (candlesDelta !== 0) {
            this.viewport.panTimeline(candlesDelta);
        }
    }

    private handleDateAxisDrag(deltaX: number): void {
        const regions = getCanvasRegions(this.canvas);
        const sensitivity = 0.5;
        
        const currentCount = this.viewport.getVisibleCandleCount();
        const zoomFactor = 1 + (deltaX / regions.dateAxis.width) * sensitivity;
        const newCount = Math.round(currentCount * zoomFactor);

        this.viewport.setTimelineZoom(newCount);
    }

    private handlePriceAxisDrag(deltaY: number): void {
        const sensitivity = 0.005;

        const zoomDelta = -deltaY * sensitivity;
        const currentZoom = this.viewport.getPriceZoomFactor();
        const newZoom = currentZoom * (1 + zoomDelta);

        // Clamp to reasonable range
        const clampedZoom = Math.max(0.5, Math.min(5.0, newZoom));
        this.viewport.setPriceZoom(clampedZoom);
    }

    private updateCursor(region: string | null): void {
        if (!region) {
            this.canvas.style.cursor = 'default';
        } else if (region === 'chartArea') {
            this.canvas.style.cursor = this.dragState.isDragging ? 'grabbing' : 'grab';
        } else if (region === 'dateAxis' || region === 'priceAxis') {
            this.canvas.style.cursor = 'ns-resize';
        }
    }

    private requestRedraw(): void {
        if (this.redrawScheduled) return;

        this.redrawScheduled = true;
        requestAnimationFrame(() => {
            this.redrawCallback();
            this.redrawScheduled = false;
        });
    }
}