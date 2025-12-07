import Decimal from "decimal.js";

// Configure Decimal.js for financial precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export function calculateTradingFee(
  amount: number,
  feePercentage: number
): number {
  const amountDecimal = new Decimal(amount);
  const feeDecimal = new Decimal(feePercentage);

  return amountDecimal.mul(feeDecimal).toNumber();
}

export function roundToDecimals(value: number, decimals: number): string {
  const decimal = new Decimal(value);
  return decimal.toFixed(decimals);
}

export function safeAdd(a: string, b: string): string {
  return new Decimal(a).add(new Decimal(b)).toString();
}

export function safeSubtract(a: string, b: string): string {
  return new Decimal(a).sub(new Decimal(b)).toString();
}

export function safeMultiply(a: string, b: string): string {
  return new Decimal(a).mul(new Decimal(b)).toString();
}

export function safeDivide(a: string, b: string): string {
  if (new Decimal(b).equals(0)) {
    throw new Error("Division by zero");
  }
  return new Decimal(a).div(new Decimal(b)).toString();
}

export function compareAmounts(a: string, b: string): number {
  const decimalA = new Decimal(a);
  const decimalB = new Decimal(b);

  if (decimalA.equals(decimalB)) return 0;
  if (decimalA.greaterThan(decimalB)) return 1;
  return -1;
}

export function formatCurrency(amount: string, currency: string): string {
  const num = parseFloat(amount);

  if (currency === "NGN") {
    return `₦${num.toLocaleString("en-NG", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (currency === "USD") {
    return `${num.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  return `${currency} ${amount}`;
}
