// /lib/integrations/price-feeds/binance.ts

/**
 * Fetches the latest price for a trading pair from Binance public API.
 * Example pair: "BTC-USDT" → Symbol: "BTCUSDT"
 */

const CACHE_TTL_MS = 5000; // cache price for 5 seconds
const priceCache = new Map<string, {price: number; expires: number}>();

function normalizePair(pair: string): string {
  // Convert "BTC-USDT" → "BTCUSDT"
  return pair.replace("-", "").toUpperCase();
}

export async function getPriceForPair(pair: string): Promise<number> {
  const symbol = normalizePair(pair);

  // Serve from cache if available and valid
  const cached = priceCache.get(symbol);
  const now = Date.now();

  if (cached && cached.expires > now) {
    return cached.price;
  }

  try {
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Binance API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data || !data.price) {
      throw new Error(`Invalid price data returned for pair: ${pair}`);
    }

    const price = parseFloat(data.price);

    if (isNaN(price)) {
      throw new Error(`Price returned is not a valid number for ${pair}`);
    }

    // Store in cache
    priceCache.set(symbol, {
      price,
      expires: now + CACHE_TTL_MS,
    });

    return price;
  } catch (err: any) {
    console.error(`Failed to fetch Binance price for ${pair}:`, err);
    throw new Error(`Failed to fetch price for ${pair}: ${err.message}`);
  }
}
