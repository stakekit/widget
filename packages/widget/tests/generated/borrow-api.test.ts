import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import * as BorrowApi from "../../src/generated/api/borrow";

describe("generated Borrow API", () => {
  it("exposes runtime schemas for borrow domain DTOs", () => {
    expect(Schema.isSchema(BorrowApi.IntegrationDto)).toBe(true);
    expect(Schema.isSchema(BorrowApi.MarketDto)).toBe(true);
    expect(Schema.isSchema(BorrowApi.PositionDto)).toBe(true);
    expect(Schema.isSchema(BorrowApi.ActionDto)).toBe(true);
    expect(Schema.isSchema(BorrowApi.TransactionDto)).toBe(true);
  });

  it("exposes the generated borrow operations needed by the widget", () => {
    const client = BorrowApi.make({} as Parameters<typeof BorrowApi.make>[0]);

    expect(client).toEqual(
      expect.objectContaining({
        ActionsControllerExecuteActionV1: expect.any(Function),
        ActionsControllerGetActionV1: expect.any(Function),
        ActionsControllerGetActionsV1: expect.any(Function),
        ActionsControllerStepV1: expect.any(Function),
        HealthControllerHealth: expect.any(Function),
        IntegrationsControllerGetIntegrationV1: expect.any(Function),
        IntegrationsControllerGetIntegrationsV1: expect.any(Function),
        MarketsControllerGetMarketByIdV1: expect.any(Function),
        MarketsControllerGetMarketsV1: expect.any(Function),
        PositionsControllerGetPositionsV1: expect.any(Function),
        TransactionsControllerSubmitTransactionV1: expect.any(Function),
      })
    );
  });
});
