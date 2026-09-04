import { RegistryProvider } from "@effect/atom-react";
import { Effect, Layer, Stream } from "effect";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it } from "vitest";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import type { BorrowFlowSession } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import { BorrowTransactionFlowRoute } from "../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { render } from "../utils/test-utils.dom.tsx";

const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="location">{location.pathname}</output>;
};

describe("Borrow Flow route identity", () => {
  it("returns a mismatched Market Position Session to the routed market", async () => {
    const session = {
      epoch: 1,
      intake: {
        entry: { _tag: "MarketPosition", marketId: "market-a" },
      },
    } as BorrowFlowSession;
    const app = await render(
      <RegistryProvider
        initialValues={[
          [
            walletRuntime.layer,
            Layer.succeed(BorrowTransactionFlowService, {
              currentSession: Stream.succeed(session),
              acquireSession: () =>
                Effect.die("Mismatched session must not be acquired"),
              start: () => Effect.die("Not used"),
            }) as never,
          ],
        ]}
      >
        <MemoryRouter initialEntries={["/positions/borrow/market-b/review"]}>
          <Routes>
            <Route
              element={<BorrowTransactionFlowRoute expected="MarketPosition" />}
              path="/positions/borrow/:marketId/review"
            />
            <Route
              element={<LocationProbe />}
              path="/positions/borrow/:marketId"
            />
          </Routes>
        </MemoryRouter>
      </RegistryProvider>
    );

    expect(
      app.container.querySelector('[data-testid="location"]')?.textContent
    ).toBe("/positions/borrow/market-b");
  });
});
