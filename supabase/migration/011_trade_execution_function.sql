CREATE OR REPLACE FUNCTION execute_spot_trade(
  p_user_id UUID,
  p_request_id UUID,
  p_pair VARCHAR(20),
  p_type VARCHAR(10),
  p_amount_quote NUMERIC(24, 4),
  p_execution_price NUMERIC(24, 4),
  p_fee NUMERIC(24, 4)
)
RETURNS TABLE (
  trade_id UUID,
  status VARCHAR(20),
  amount_base NUMERIC(24, 10)
)
AS $$
DECLARE
  v_base_asset_id UUID;
  v_base_ticker VARCHAR(10);
  v_quote_currency VARCHAR(3);
  v_quote_wallet_id UUID;
  v_base_wallet_id UUID;
  v_calculated_base NUMERIC(24, 10);
  v_quote_balance NUMERIC(24, 4);
  v_crypto_balance NUMERIC(24, 10);
  v_trade_id UUID;
BEGIN
  -- Parse trading pair
  v_base_ticker := split_part(p_pair, '-', 1);
  v_quote_currency := split_part(p_pair, '-', 2);

  -- Get base asset
  SELECT id INTO v_base_asset_id
  FROM crypto_assets
  WHERE ticker = v_base_ticker AND is_active = TRUE;

  IF v_base_asset_id IS NULL THEN
    RAISE EXCEPTION 'Invalid trading pair: %', p_pair;
  END IF;

  -- Get user's fiat wallet (with row lock)
  SELECT id, balance INTO v_quote_wallet_id, v_quote_balance
  FROM fiat_wallets
  WHERE user_id = p_user_id AND currency = v_quote_currency
  FOR UPDATE;

  IF v_quote_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Quote currency wallet not found';
  END IF;

  -- Get or create crypto wallet
  SELECT id, balance INTO v_base_wallet_id, v_crypto_balance
  FROM crypto_wallets
  WHERE user_id = p_user_id AND asset_id = v_base_asset_id
  FOR UPDATE;

  IF v_base_wallet_id IS NULL THEN
    INSERT INTO crypto_wallets (user_id, asset_id, balance)
    VALUES (p_user_id, v_base_asset_id, 0)
    RETURNING id, balance INTO v_base_wallet_id, v_crypto_balance;
  END IF;

  IF p_type = 'BUY' THEN
    -- Calculate base amount for BUY
    v_calculated_base := (p_amount_quote - p_fee) / p_execution_price;

    -- Verify sufficient fiat balance
    IF v_quote_balance < (p_amount_quote + p_fee) THEN
      RAISE EXCEPTION 'Insufficient fiat balance. Required: %, Available: %',
        (p_amount_quote + p_fee), v_quote_balance;
    END IF;

    -- Debit fiat wallet
    UPDATE fiat_wallets
    SET balance = balance - (p_amount_quote + p_fee),
        updated_at = NOW()
    WHERE id = v_quote_wallet_id;

    -- Credit crypto wallet
    UPDATE crypto_wallets
    SET balance = balance + v_calculated_base,
        updated_at = NOW()
    WHERE id = v_base_wallet_id;

  ELSIF p_type = 'SELL' THEN
    -- Calculate base amount for SELL
    v_calculated_base := p_amount_quote / p_execution_price;

    -- Verify sufficient crypto balance
    IF v_crypto_balance < v_calculated_base THEN
      RAISE EXCEPTION 'Insufficient crypto balance. Required: %, Available: %',
        v_calculated_base, v_crypto_balance;
    END IF;

    -- Debit crypto wallet
    UPDATE crypto_wallets
    SET balance = balance - v_calculated_base,
        updated_at = NOW()
    WHERE id = v_base_wallet_id;

    -- Credit fiat wallet (after fee)
    UPDATE fiat_wallets
    SET balance = balance + (p_amount_quote - p_fee),
        updated_at = NOW()
    WHERE id = v_quote_wallet_id;

  ELSE
    RAISE EXCEPTION 'Invalid trade type: %', p_type;
  END IF;

  -- Create trade transaction record
  INSERT INTO trade_transactions (
    user_id, request_id, pair, type,
    amount_base, amount_quote, execution_price, fee, fee_currency,
    status, executed_at
  ) VALUES (
    p_user_id, p_request_id, p_pair, p_type,
    v_calculated_base, p_amount_quote, p_execution_price, p_fee, v_quote_currency,
    'executed', NOW()
  )
  RETURNING id INTO v_trade_id;

  -- Return result
  RETURN QUERY
  SELECT v_trade_id, 'executed'::VARCHAR(20), v_calculated_base;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
