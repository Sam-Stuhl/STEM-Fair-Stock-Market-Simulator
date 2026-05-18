const POINTS_PER_CANDLE = 20;
// Annualized GBM parameters per regime.
// mu controls trend direction; sigma controls noise.
// bull/bear mu values produce ~0.3-0.4% per candle at 1 candle/second — clearly directional
// without being so extreme that the price collapses or doubles in under a minute.
const REGIME_PARAMS = {
    normal: { mu: 0.05, sigma: 0.40 },
    bull: { mu: 0.9, sigma: 0.30 },
    bear: { mu: -1.1, sigma: 0.50 },
};
let currentRegime = 'normal';
export function setRegime(regime) {
    currentRegime = regime;
}
export function getRegime() {
    return currentRegime;
}
// Box-Muller transform: converts two uniform samples into a standard normal sample.
function randomNormal() {
    let u1;
    do {
        u1 = Math.random();
    } while (u1 === 0); // guard against log(0)
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
export function generateCandle(startPrice, date) {
    const { mu, sigma } = REGIME_PARAMS[currentRegime];
    // dt = fraction of a trading year represented by one price point
    const dt = 1 / (252 * POINTS_PER_CANDLE);
    const path = [startPrice];
    for (let i = 1; i < POINTS_PER_CANDLE; i++) {
        const prev = path[path.length - 1];
        const drift = (mu - sigma ** 2 / 2) * dt;
        const shock = sigma * Math.sqrt(dt) * randomNormal();
        path.push(prev * Math.exp(drift + shock));
    }
    return {
        open: path[0],
        close: path[POINTS_PER_CANDLE - 1],
        high: Math.max(...path),
        low: Math.min(...path),
        date,
        isInEvent: currentRegime !== 'normal',
        price_path: path,
    };
}
// Advances a date string by one business day (skips weekends).
export function nextBusinessDate(dateStr) {
    const d = new Date(dateStr);
    d.setUTCDate(d.getUTCDate() + 1);
    while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
        d.setUTCDate(d.getUTCDate() + 1);
    }
    return d.toISOString().split('T')[0];
}
