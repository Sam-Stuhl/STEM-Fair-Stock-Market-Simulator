interface Candle {
    open: number;
    high: number | null;
    close: number | null;
    low: number | null;
    openTime: number;
    closeTime: number | null;
    isInEvent: boolean; // This would be true if the candle is a part of a predetermined event. Not randomized
}

interface PortfolioSnapshot {
    id: number;
    timestamp: number;
    transactionType: string;
    stockPrice: number;
    shareQuantity: number;
    sharesOwnedBefore: number;
    sharesOwnedAfter: number;
    currentBalance: number;
}

interface PortfolioData {
    id: number;
    start: PortfolioSnapshot | null;
    end: PortfolioSnapshot | null;
    statesInBetween: PortfolioSnapshot[];
}

interface Session {
    id: number;
    startTime: number;
    endTime: number | null;
    isRealSession: boolean; // False if test
    candleData: Candle[];
    portfolioData: PortfolioData;
}