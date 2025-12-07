import { executeTrade } from "@/lib/services/trade.service";
import { supabaseAdmin } from "@/lib/supabase/admin";

jest.mock("@/lib/supabase/admin");
jest.mock("@/lib/integrations/price-feeds/binance");

describe("Trade Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("executeTrade", () => {
    it("should execute a BUY trade successfully", async () => {
      const mockRpcResponse = {
        data: [
          {
            trade_id: "123e4567-e89b-12d3-a456-426614174000",
            status: "executed",
            amount_base: "0.0117647059",
          },
        ],
        error: null,
      };

      (supabaseAdmin.rpc as jest.Mock).mockResolvedValue(mockRpcResponse);

      const result = await executeTrade({
        userId: "user-123",
        requestId: "request-456",
        pair: "BTC-NGN",
        type: "BUY",
        amount: "1000000.00",
      });

      expect(result.status).toBe("executed");
      expect(result.pair).toBe("BTC-NGN");
      expect(result.type).toBe("BUY");
    });

    it("should throw error on insufficient funds", async () => {
      const mockError = new Error("Insufficient fiat balance");

      (supabaseAdmin.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: mockError,
      });

      await expect(
        executeTrade({
          userId: "user-123",
          requestId: "request-456",
          pair: "BTC-NGN",
          type: "BUY",
          amount: "1000000.00",
        })
      ).rejects.toThrow("Trade execution failed");
    });
  });
});
