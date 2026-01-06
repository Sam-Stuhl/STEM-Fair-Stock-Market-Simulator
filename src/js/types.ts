interface Candle {
    open: number;
    high: number;
    close: number;
    low: number;
    date: string;
    isInEvent: boolean; // This would be true if the candle is a part of a predetermined event. Not randomized
    price_path: number[];
}

interface PortfolioSnapshot {
    id: number;
    timestamp: string;
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
    startTime: string;
    endTime: string | null;
    isRealSession: boolean; // False if test
    candleData: Candle[];
    portfolioData: PortfolioData;
}