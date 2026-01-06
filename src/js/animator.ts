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