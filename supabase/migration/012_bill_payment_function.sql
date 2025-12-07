CREATE OR REPLACE FUNCTION execute_bill_payment(
  p_user_id UUID,
  p_request_id UUID,
  p_category VARCHAR(50),
  p_provider VARCHAR(50),
  p_amount NUMERIC(24, 4),
  p_fiat_wallet_id UUID,
  p_recipient_details JSONB
)
RETURNS TABLE (
  payment_id UUID,
  status VARCHAR(20)
)
AS $$
DECLARE
  v_wallet_balance NUMERIC(24, 4);
  v_payment_id UUID;
BEGIN
  -- Get wallet balance with row lock
  SELECT balance INTO v_wallet_balance
  FROM fiat_wallets
  WHERE id = p_fiat_wallet_id AND user_id = p_user_id
  FOR UPDATE;

  IF v_wallet_balance IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  -- Verify sufficient balance
  IF v_wallet_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Required: %, Available: %',
      p_amount, v_wallet_balance;
  END IF;

  -- Debit wallet
  UPDATE fiat_wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_fiat_wallet_id;

  -- Create bill payment record
  INSERT INTO bill_payments (
    user_id, request_id, category, provider,
    amount_ngn, fiat_wallet_id, recipient_details,
    status
  ) VALUES (
    p_user_id, p_request_id, p_category, p_provider,
    p_amount, p_fiat_wallet_id, p_recipient_details,
    'processing'
  )
  RETURNING id INTO v_payment_id;

  -- Return result
  RETURN QUERY
  SELECT v_payment_id, 'processing'::VARCHAR(20);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
