CREATE OR REPLACE FUNCTION verify_sufficient_funds(
  p_wallet_id UUID,
  p_user_id UUID,
  p_required_amount NUMERIC,
  p_wallet_type VARCHAR
)
RETURNS BOOLEAN
AS $$
DECLARE
  v_available_balance NUMERIC;
BEGIN
  IF p_wallet_type = 'fiat' THEN
    SELECT (balance - reserved_balance)
    INTO v_available_balance
    FROM fiat_wallets
    WHERE id = p_wallet_id
      AND user_id = p_user_id;
  ELSE
    SELECT (balance - reserved_balance)
    INTO v_available_balance
    FROM crypto_wallets
    WHERE id = p_wallet_id
      AND user_id = p_user_id;
  END IF;

  RETURN v_available_balance >= p_required_amount;
END;
$$ LANGUAGE plpgsql;
