let state = {
    currentPrice: 0,
    currentOpenCandle: null,
    candleHistory: [],
    currentPortfolioState: null,
    currentSession: null
};
export function updatePrice(newPrice) {
    state.currentPrice = newPrice;
}
// --- Candles ---
export function updateCandle(newCandle) {
    state.currentOpenCandle = newCandle;
}
export function closeCandle() {
    if (state.currentOpenCandle) {
        state.candleHistory.push(state.currentOpenCandle);
    }
}
// --- Portfolio ---
export function recordBuy(numShares, sharesPrice) {
    // Guard clause: exit early if state is invalid
    if (!state.currentPortfolioState || !state.currentSession)
        return;
    const totalSpent = numShares * sharesPrice;
    const newBalance = state.currentPortfolioState.currentBalance - totalSpent;
    const sharesOwnedBefore = state.currentPortfolioState.sharesOwnedAfter;
    const sharesOwnedAfter = state.currentPortfolioState.sharesOwnedAfter + numShares;
    // Save the old portfolio snapshot to history
    state.currentSession.portfolioData.statesInBetween.push(state.currentPortfolioState);
    // Create new portfolio state after the transaction
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDay();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    state.currentPortfolioState = {
        id: 0,
        timestamp: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`,
        transactionType: "buy",
        stockPrice: state.currentPrice,
        shareQuantity: numShares,
        sharesOwnedBefore: sharesOwnedBefore,
        sharesOwnedAfter: sharesOwnedAfter,
        currentBalance: newBalance
    };
}
export function recordSell(numShares, sharesPrice) {
    // Guard clause: exit early if state is invalid
    if (!state.currentPortfolioState || !state.currentSession)
        return;
    const totalEarned = numShares * sharesPrice;
    const newBalance = state.currentPortfolioState.currentBalance + totalEarned;
    const sharesOwnedBefore = state.currentPortfolioState.sharesOwnedAfter;
    const sharesOwnedAfter = state.currentPortfolioState.sharesOwnedAfter - numShares;
    // Save the old portfolio snapshot to history
    state.currentSession.portfolioData.statesInBetween.push(state.currentPortfolioState);
    // Create new portfolio state after the transaction
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDay();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    state.currentPortfolioState = {
        id: 0,
        timestamp: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`,
        transactionType: "sell",
        stockPrice: state.currentPrice,
        shareQuantity: numShares,
        sharesOwnedBefore: sharesOwnedBefore,
        sharesOwnedAfter: sharesOwnedAfter,
        currentBalance: newBalance
    };
}
// --- Session ---
export function initializeSession(isTest) {
    // Create new Session Object 
    let now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDay();
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let seconds = now.getSeconds();
    let startingPortfolio = {
        id: 0,
        timestamp: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`,
        transactionType: "start",
        stockPrice: 0,
        shareQuantity: 0,
        sharesOwnedBefore: 0,
        sharesOwnedAfter: 0,
        currentBalance: 10000
    };
    let session = {
        id: 0, // temporary
        startTime: `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`,
        endTime: null,
        isRealSession: !isTest,
        candleData: [],
        portfolioData: { id: 0, start: startingPortfolio, end: null, statesInBetween: [] }
    };
    state.currentSession = session;
    return session;
}
export function endSession() {
    // Add old session to the history
    // not sure how to do this yet
}
export function getState() {
    return state;
}
