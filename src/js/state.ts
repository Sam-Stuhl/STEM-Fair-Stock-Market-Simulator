interface State {
    currentPrice: number;
    currentOpenCandle: Candle | null;
    candleHistory: Candle[];
    currentPortfolioState: PortfolioSnapshot | null;
    currentSession: Session | null;
}

let state: State = {
    currentPrice : 0,
    currentOpenCandle : null,
    candleHistory : [],
    currentPortfolioState : null,
    currentSession : null
}


export function updatePrice(newPrice: number) : void {
    state.currentPrice = newPrice;
}

// --- Candles ---
export function updateCandle(newCandle: Candle) : void {
    state.currentOpenCandle = newCandle
}

export function closeCandle() : void {
    if (state.currentOpenCandle) {
        state.candleHistory.push(state.currentOpenCandle);
    }
}

// --- Portfolio ---
export function recordBuy(numShares: number, sharesPrice: number) : void {
    // Guard clause: exit early if state is invalid
    if (!state.currentPortfolioState || !state.currentSession) return;

    const totalSpent = numShares * sharesPrice;
    const newBalance = state.currentPortfolioState.currentBalance - totalSpent;
    const sharesOwnedBefore = state.currentPortfolioState.sharesOwnedAfter;
    const sharesOwnedAfter = state.currentPortfolioState.sharesOwnedAfter + numShares;

    // Save the old portfolio snapshot to history
    state.currentSession.portfolioData.statesInBetween.push(state.currentPortfolioState);

    // Create new portfolio state after the transaction
    state.currentPortfolioState = {
        id : 0,
        timestamp : Date.now(),
        transactionType : "buy",
        stockPrice : state.currentPrice,
        shareQuantity : numShares,
        sharesOwnedBefore : sharesOwnedBefore,
        sharesOwnedAfter : sharesOwnedAfter,
        currentBalance : newBalance
    };
}

export function recordSell(numShares: number, sharesPrice: number) : void {
    // Guard clause: exit early if state is invalid
    if (!state.currentPortfolioState || !state.currentSession) return;

    const totalEarned = numShares * sharesPrice;
    const newBalance = state.currentPortfolioState.currentBalance + totalEarned;
    const sharesOwnedBefore = state.currentPortfolioState.sharesOwnedAfter;
    const sharesOwnedAfter = state.currentPortfolioState.sharesOwnedAfter - numShares;

    // Save the old portfolio snapshot to history
    state.currentSession.portfolioData.statesInBetween.push(state.currentPortfolioState);

    // Create new portfolio state after the transaction
    state.currentPortfolioState = {
        id : 0,
        timestamp : Date.now(),
        transactionType : "sell",
        stockPrice : state.currentPrice,
        shareQuantity : numShares,
        sharesOwnedBefore : sharesOwnedBefore,
        sharesOwnedAfter : sharesOwnedAfter,
        currentBalance : newBalance
    };
}

// --- Session ---

export function initializeSession(isTest: boolean) : Session {
    // Create new Session Object 

    let startingPortfolio = {
        id : 0,
        timestamp : Date.now(),
        transactionType : "start",
        stockPrice : 0,
        shareQuantity : 0,
        sharesOwnedBefore : 0,
        sharesOwnedAfter : 0,
        currentBalance : 10000
    }

    let session = {
        id : 0, // temporary
        startTime : Date.now(),
        endTime : null,
        isRealSession : !isTest,
        candleData : [],
        portfolioData : {id : 0, start : startingPortfolio, end : null, statesInBetween : []} 
    }

    state.currentSession = session;
    return session;
}

export function endSession() : void {
    // Add old session to the history
    // not sure how to do this yet
}







export function getState() : State {
    return state
}