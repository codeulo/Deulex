import { supabaseAdmin } from "@/lib/supabase/admin";

export interface BillCategory {
  category_id: string;
  name: string;
  description: string;
  providers: Array<{
    provider_id: string;
    name: string;
    min_amount: string;
    max_amount: string;
  }>;
}

export async function getBillCategories(): Promise<BillCategory[]> {
  // For MVP, return hardcoded categories
  // TODO: Store in database and integrate with bill payment providers
  return [
    {
      category_id: "airtime",
      name: "Airtime",
      description: "Mobile airtime recharge",
      providers: [
        {
          provider_id: "MTN",
          name: "MTN Nigeria",
          min_amount: "50.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "GLO",
          name: "Glo Mobile",
          min_amount: "50.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "AIRTEL",
          name: "Airtel Nigeria",
          min_amount: "50.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "9MOBILE",
          name: "9mobile",
          min_amount: "50.00",
          max_amount: "50000.00",
        },
      ],
    },
    {
      category_id: "data",
      name: "Data",
      description: "Mobile data bundles",
      providers: [
        {
          provider_id: "MTN",
          name: "MTN Nigeria",
          min_amount: "100.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "GLO",
          name: "Glo Mobile",
          min_amount: "100.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "AIRTEL",
          name: "Airtel Nigeria",
          min_amount: "100.00",
          max_amount: "50000.00",
        },
        {
          provider_id: "9MOBILE",
          name: "9mobile",
          min_amount: "100.00",
          max_amount: "50000.00",
        },
      ],
    },
    {
      category_id: "electricity",
      name: "Electricity",
      description: "Prepaid electricity tokens",
      providers: [
        {
          provider_id: "EKEDC",
          name: "Eko Electricity",
          min_amount: "500.00",
          max_amount: "100000.00",
        },
        {
          provider_id: "IKEDC",
          name: "Ikeja Electric",
          min_amount: "500.00",
          max_amount: "100000.00",
        },
      ],
    },
  ];
}

export async function executeBillPayment(params: {
  userId: string;
  requestId: string;
  categoryId: string;
  amount: string;
  fiatWalletId: string;
  recipientDetails: Record<string, any>;
}): Promise<any> {
  const {
    userId,
    requestId,
    categoryId,
    amount,
    fiatWalletId,
    recipientDetails,
  } = params;

  // Step 1: Verify wallet ownership and sufficient funds
  const { data: wallet, error: walletError } = await supabaseAdmin
    .from("fiat_wallets")
    .select("balance, reserved_balance, currency")
    .eq("id", fiatWalletId)
    .eq("user_id", userId)
    .single();

  if (walletError || !wallet) {
    throw new Error("Wallet not found or unauthorized");
  }

  const availableBalance =
    parseFloat(wallet.balance) - parseFloat(wallet.reserved_balance);
  const paymentAmount = parseFloat(amount);

  if (availableBalance < paymentAmount) {
    throw new Error(
      `Insufficient balance. Available: ${availableBalance.toFixed(4)} ${
        wallet.currency
      }`
    );
  }

  // Step 2: Create bill payment record
  const providerRefId = `${
    recipientDetails.provider
  }-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("bill_payments")
    .insert({
      user_id: userId,
      request_id: requestId,
      category: categoryId,
      provider: recipientDetails.provider,
      amount_ngn: amount,
      fiat_wallet_id: fiatWalletId,
      recipient_details: recipientDetails,
      status: "processing",
      provider_reference_id: providerRefId,
    })
    .select("*")
    .single();

  if (paymentError) {
    throw new Error(`Failed to create bill payment: ${paymentError.message}`);
  }

  // Step 3: Deduct from wallet balance (in transaction)
  const { error: deductError } = await supabaseAdmin.rpc(
    "deduct_fiat_balance",
    {
      p_wallet_id: fiatWalletId,
      p_amount: amount,
    }
  );

  if (deductError) {
    // Rollback: Update payment status to failed
    await supabaseAdmin
      .from("bill_payments")
      .update({ status: "failed", failure_reason: "Insufficient funds" })
      .eq("id", payment.id);

    throw new Error("Failed to deduct balance");
  }

  // Step 4: Process with bill payment provider (async)
  // TODO: Integrate with actual bill payment API
  // For MVP, mark as completed immediately
  await supabaseAdmin
    .from("bill_payments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", payment.id);

  return {
    payment_id: payment.id,
    category: categoryId,
    amount_ngn: amount,
    status: "completed",
    provider_reference_id: providerRefId,
    created_at: payment.created_at,
  };
}

export async function getBillPaymentHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0
) {
  const { data, error } = await supabaseAdmin
    .from("bill_payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to fetch bill payment history: ${error.message}`);
  }

  return data;
}
