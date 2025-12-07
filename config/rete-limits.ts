export const RATE_LIMITS = {
  // Authentication endpoints
  AUTH_LOGIN: {
    requests: 5,
    window: "15m",
    prefix: "auth:login",
  },
  AUTH_2FA: {
    requests: 5,
    window: "15m",
    prefix: "auth:2fa",
  },

  // Trading endpoints
  TRADE_EXECUTION: {
    requests: 10,
    window: "1m",
    prefix: "trade:execute",
  },
  TICKER_FETCH: {
    requests: 60,
    window: "1m",
    prefix: "ticker:fetch",
  },

  // Bill payments
  BILL_PAYMENT: {
    requests: 5,
    window: "1m",
    prefix: "bills:pay",
  },

  // Withdrawals
  CRYPTO_WITHDRAWAL: {
    requests: 3,
    window: "1h",
    prefix: "withdrawal:crypto",
  },

  // General API
  API_GENERAL: {
    requests: 100,
    window: "1m",
    prefix: "api:general",
  },
} as const;
