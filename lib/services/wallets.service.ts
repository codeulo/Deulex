import { supabaseAdmin } from "@/lib/supabase/admin";

export interface WalletBalance {
  wallet_id: string;
  user_id: string;
  currency?: string;
  asset_ticker?: string;
  balance: string;
  reserved_balance: string;
  available_balance: string;
  created_at: string;
  updated_at: string;
}

export async function getFiatWallets(userId: string): Promise<WalletBalance[]> {
  const { data, error } = await supabaseAdmin
    .from("fiat_wallets")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch fiat wallets: ${error.message}`);
  }

  return (data || []).map((wallet) => ({
    ...wallet,
    available_balance: (
      parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance)
    ).toFixed(4),
  }));
}

export async function getCryptoWallets(
  userId: string
): Promise<WalletBalance[]> {
  const { data, error } = await supabaseAdmin
    .from("crypto_wallets")
    .select(
      `
      *,
      crypto_assets (
        ticker,
        name,
        precision_decimals
      )
    `
    )
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to fetch crypto wallets: ${error.message}`);
  }

  return (data || []).map((wallet) => ({
    wallet_id: wallet.id,
    user_id: wallet.user_id,
    asset_ticker: wallet.crypto_assets?.ticker,
    balance: wallet.balance,
    reserved_balance: wallet.reserved_balance,
    available_balance: (
      parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance)
    ).toFixed(wallet.crypto_assets?.precision_decimals || 8),
    created_at: wallet.created_at,
    updated_at: wallet.updated_at,
  }));
}

export async function verifySufficientFunds(
  userId: string,
  walletId: string,
  requiredAmount: string,
  walletType: "fiat" | "crypto"
): Promise<{ sufficient: boolean; availableBalance: string }> {
  const table = walletType === "fiat" ? "fiat_wallets" : "crypto_wallets";

  const { data: wallet, error } = await supabaseAdmin
    .from(table)
    .select("balance, reserved_balance")
    .eq("id", walletId)
    .eq("user_id", userId)
    .single();

  if (error || !wallet) {
    throw new Error("Wallet not found");
  }

  const availableBalance =
    parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance);
  const required = parseFloat(requiredAmount);

  return {
    sufficient: availableBalance >= required,
    availableBalance: availableBalance.toFixed(walletType === "fiat" ? 4 : 10),
  };
}

export async function initiateFiatDeposit(params: {
  userId: string;
  amount: string;
  currency: string;
  paymentMethod: string;
}): Promise<any> {
  const { userId, amount, currency, paymentMethod } = params;

  // Get or create user's fiat wallet
  let { data: wallet } = await supabaseAdmin
    .from("fiat_wallets")
    .select("id")
    .eq("user_id", userId)
    .eq("currency", currency)
    .single();

  if (!wallet) {
    const { data: newWallet, error } = await supabaseAdmin
      .from("fiat_wallets")
      .insert({
        user_id: userId,
        currency,
        balance: "0.0000",
      })
      .select("id")
      .single();

    if (error) throw new Error("Failed to create wallet");
    wallet = newWallet;
  }

  // Create deposit transaction record
  const paymentReference = `FT-DEP-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 6)
    .toUpperCase()}`;

  const { data: deposit, error } = await supabaseAdmin
    .from("deposit_transactions")
    .insert({
      user_id: userId,
      fiat_wallet_id: wallet.id,
      amount,
      currency,
      payment_method: paymentMethod,
      payment_reference: paymentReference,
      status: "pending",
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Failed to create deposit: ${error.message}`);
  }

  // TODO: Integrate with payment gateway (Paystack/Flutterwave)
  // For now, return manual bank transfer instructions

  return {
    deposit_id: deposit.id,
    status: "pending",
    payment_reference: paymentReference,
    payment_instructions: {
      account_number: "9876543210",
      bank_name: "Providus Bank",
      account_name: "FireTrade Limited",
      amount: amount,
      reference: paymentReference,
    },
    expires_at: deposit.expires_at,
  };
}

export async function initiateCryptoWithdrawal(params: {
  userId: string;
  requestId: string;
  assetTicker: string;
  amount: string;
  destinationAddress: string;
  network: string;
  twoFaCode: string;
}): Promise<any> {
  const {
    userId,
    requestId,
    assetTicker,
    amount,
    destinationAddress,
    network,
  } = params;

  // Verify 2FA code
  // TODO: Implement 2FA verification

  // Get asset details
  const { data: asset, error: assetError } = await supabaseAdmin
    .from("crypto_assets")
    .select("*")
    .eq("ticker", assetTicker)
    .single();

  if (assetError || !asset) {
    throw new Error("Asset not found");
  }

  // Get user's crypto wallet
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from("crypto_wallets")
    .select("*")
    .eq("user_id", userId)
    .eq("asset_id", asset.id)
    .single();

  if (walletError || !wallet) {
    throw new Error("Wallet not found");
  }

  // Verify sufficient balance
  const withdrawalAmount = parseFloat(amount);
  const fee = parseFloat(asset.withdrawal_fee);
  const totalRequired = withdrawalAmount + fee;

  const availableBalance =
    parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance);

  if (availableBalance < totalRequired) {
    throw new Error(
      `Insufficient balance. Required: ${totalRequired}, Available: ${availableBalance}`
    );
  }

  // Create withdrawal transaction
  const { data: withdrawal, error: withdrawalError } = await supabaseAdmin
    .from("withdrawal_transactions")
    .insert({
      user_id: userId,
      request_id: requestId,
      crypto_wallet_id: wallet.id,
      asset_id: asset.id,
      amount: amount,
      fee: asset.withdrawal_fee,
      destination_address: destinationAddress,
      network,
      status: "pending_approval",
    })
    .select("*")
    .single();

  if (withdrawalError) {
    throw new Error(`Failed to create withdrawal: ${withdrawalError.message}`);
  }

  // Reserve the amount in wallet
  await supabaseAdmin
    .from("crypto_wallets")
    .update({
      reserved_balance: (
        parseFloat(wallet.reserved_balance) + totalRequired
      ).toFixed(10),
    })
    .eq("id", wallet.id);

  return {
    withdrawal_id: withdrawal.id,
    status: "pending_approval",
    estimated_fee: asset.withdrawal_fee,
    estimated_completion: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 min
  };
}
