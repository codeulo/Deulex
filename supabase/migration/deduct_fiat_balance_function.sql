CREATE OR REPLACE FUNCTION deduct_fiat_balance(
  p_wallet_id UUID,
  p_amount NUMERIC
)
RETURNS VOID
AS $$
BEGIN
  UPDATE fiat_wallets
  SET balance = balance - p_amount,
      updated_at = NOW()
  WHERE id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;
END;
$$ LANGUAGE plpgsql;
