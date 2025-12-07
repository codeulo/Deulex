import { supabaseAdmin } from "@/lib/supabase/admin";
import { calculateTradingFee } from "@/lib/utils/money";
import { getPriceForPair } from "../integrations/price-feeds/binance";

export interface ExecuteTradeParams {
  userId: string;
  requestId: string;
  pair: string;
  type: "BUY" | "SELL";
  amount: string; // Quote currency amount (NGN)
}

export interface TradeResult {
  trade_id: string;
  pair: string;
  type: string;
  amount_base: string;
  amount_quote: string;
  execution_price: string;
  fee: string;
  status: string;
  executed_at: string;
}

export async function executeTrade(
  params: ExecuteTradeParams
): Promise<TradeResult> {
  const { userId, requestId, pair, type, amount } = params;

  // Parse pair (e.g., 'BTC-NGN' -> ['BTC', 'NGN'])
  const [baseAsset, quoteCurrency] = pair.split("-");

  // Step 1: Get current market price
  const currentPrice = await getPriceForPair(pair);

  if (!currentPrice) {
    throw new Error("Unable to fetch current market price");
  }

  // Step 2: Calculate amounts and fees
  const amountQuote = parseFloat(amount);
  const tradingFee = calculateTradingFee(amountQuote, 0.0025); // 0.25% fee
  const netAmount = type === "BUY" ? amountQuote - tradingFee : amountQuote;
  const amountBase = netAmount / Number(currentPrice);

  // Step 3: Execute trade in database transaction
  const { data, error } = await supabaseAdmin.rpc("execute_spot_trade", {
    p_user_id: userId,
    p_request_id: requestId,
    p_pair: pair,
    p_type: type,
    p_amount_quote: amountQuote.toFixed(4),
    p_execution_price: currentPrice.toString(),
    p_fee: tradingFee.toFixed(4),
  });

  if (error) {
    throw new Error(`Trade execution failed: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("Trade execution returned no data");
  }

  const result = data[0];

  return {
    trade_id: result.trade_id,
    pair,
    type,
    amount_base: result.amount_base,
    amount_quote: amount,
    execution_price: currentPrice.toString(),
    fee: tradingFee.toFixed(4),
    status: result.status,
    executed_at: new Date().toISOString(),
  };
}

export async function getTradeHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  const { data, error } = await supabaseAdmin
    .from("trade_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch trade history: ${error.message}`);
  }

  return data;
}

export async function getTrade(userId: string, tradeId: string) {
  const { data, error } = await supabaseAdmin
    .from("trade_transactions")
    .select("*")
    .eq("id", tradeId)
    .eq("user_id", userId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch trade: ${error.message}`);
  }

  return data;
}
