import { RegistryProvider, useAtomValue } from "@effect/atom-react";
import { describe, expect, it, vi } from "@effect/vitest";
import {
  Deferred,
  Effect,
  Layer,
  Schema,
  Stream,
  SubscriptionRef,
} from "effect";
import * as Atom from "effect/reactivity/Atom";
import { act } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { Action } from "../../src/domain/borrow/execution/action";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  BorrowFlowSession,
  makeBorrowFlowNavigationState,
} from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlowExecution,
} from "../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import { render } from "../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const borrowSession = new BorrowFlowSession({
  walletScope,
  intake: {
    command: {
      action: "borrow",
      address,
      args: { marketId: Schema.decodeSync(MarketId)("market-1") },
      integrationId: Schema.decodeSync(IntegrationId)("provider-1"),
    },
    entry: { _tag: "BorrowEntry" },
    summary: {
      action: "borrow",
      borrowAmount: "1",
      existingCollateralUsd: "100",
      existingDebtUsd: "0",
      loanTokenSymbol: "USDC",
      marketLabel: "USDC market",
      network: "ethereum",
      projectedCollateralUsd: "100",
      projectedDebtUsd: "1",
      providerName: "Provider",
      riskStatus: "unavailable",
      warnings: [],
    },
  },
});

const actEffect = <A,>(effect: Effect.Effect<A>) =>
  Effect.promise(() =>
    act(async () => {
      // ast-grep-ignore: no-run-effect-in-test -- React act is a Promise-based boundary; keep Effect-driven React updates inside it.
      await Effect.runPromise(effect);
    })
  );

const BorrowExecutionProbe = () => {
  const execution = useBorrowTransactionFlowExecution();
  const view = useAtomValue(execution.viewAtom);
  return (
    <>
      <output>{view.isDone ? "done" : "pending"}</output>
      <Outlet />
    </>
  );
};

describe("Borrow completion admission", () => {
  it.live(
    "does not bounce to Steps while its existing execution projection is behind",
    () =>
      Effect.gen(function* () {
        const action = yield* Schema.decodeEffect(Action)({
          action: "borrow",
          address,
          createdAt: "2026-01-01T00:00:00.000Z",
          currentStep: 1,
          hasNextStep: false,
          id: "action-1",
          integrationId: "provider-1",
          rawArguments: borrowSession.intake.command.args,
          status: "CREATED",
          totalSteps: 1,
          transactions: [],
        });
        const initial = initializeTransactionWorkflow(
          new BorrowTransactionWorkflowInput({ action, walletScope })
        );
        const completed: TransactionWorkflowState = {
          _tag: "Completed",
          context: initial.context,
        };
        const current =
          yield* SubscriptionRef.make<TransactionWorkflowState>(initial);
        const ready = yield* Deferred.make<void>();
        const projectionReady = yield* Deferred.make<void>();
        let subscriptions = 0;
        const states = Stream.unwrap(
          Effect.sync(() => {
            subscriptions += 1;
            // Delay the existing view independently of the fresh route read.
            return subscriptions === 1
              ? Stream.concat(
                  Stream.succeed(initial),
                  Stream.unwrap(
                    Deferred.await(projectionReady).pipe(
                      Effect.as(SubscriptionRef.changes(current))
                    )
                  )
                )
              : Stream.unwrap(
                  Deferred.await(ready).pipe(
                    Effect.as(SubscriptionRef.changes(current))
                  )
                );
          })
        );
        const acquireExecution = vi.fn(() =>
          Effect.succeed({
            _tag: "Acquired" as const,
            execution: {
              states,
              back: () => Effect.void,
              finish: () => Effect.succeed({ _tag: "Accepted" as const }),
              runWorkflow: () => Effect.void,
            },
          })
        );
        const service = BorrowTransactionFlowService.of({
          openSession: () =>
            Effect.succeed({
              intake: borrowSession.intake,
              acquireExecution,
              acquireReview: () => Effect.die("Not used"),
            }),
          start: () => Effect.die("Not used"),
        });
        const router = createMemoryRouter(
          [
            { path: "/borrow", element: <div>Entry</div> },
            {
              element: <BorrowTransactionFlowRoute expected="BorrowEntry" />,
              children: [
                {
                  element: (
                    <BorrowTransactionFlowExecutionScope>
                      <BorrowExecutionProbe />
                    </BorrowTransactionFlowExecutionScope>
                  ),
                  children: [
                    { path: "/borrow/steps", element: <div>Steps</div> },
                    {
                      element: <BorrowTransactionFlowCompletionGuard />,
                      children: [
                        {
                          path: "/borrow/complete",
                          element: <div>Complete</div>,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
          {
            initialEntries: [
              {
                pathname: "/borrow/steps",
                state: makeBorrowFlowNavigationState(borrowSession),
              },
            ],
          }
        );
        const app = yield* Effect.promise(() =>
          render(
            <RegistryProvider
              initialValues={[
                Atom.initialValue(
                  walletRuntime.layer,
                  Layer.succeed(BorrowTransactionFlowService, service) as never
                ),
              ]}
            >
              <RouterProvider router={router} />
            </RegistryProvider>
          )
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(app.container.textContent).toContain("Steps"))
        );
        expect(app.container.textContent).toContain("pending");
        yield* SubscriptionRef.set(current, completed);
        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/borrow/complete");
          })
        );
        expect(router.state.location.pathname).toBe("/borrow/complete");
        expect(
          app.container.querySelector('[aria-busy="true"]')
        ).not.toBeNull();
        yield* actEffect(Deferred.succeed(ready, undefined));
        expect(router.state.location.pathname).toBe("/borrow/complete");
        expect(
          app.container.querySelector('[aria-busy="true"]')
        ).not.toBeNull();
        expect(app.container.textContent).toContain("pending");
        yield* actEffect(Deferred.succeed(projectionReady, undefined));
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(app.container.textContent).toContain("Complete")
          )
        );
        expect(app.container.textContent).toContain("done");
        expect(acquireExecution).toHaveBeenCalledTimes(1);

        // Revisiting Complete must not reuse its previous successful admission.
        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/borrow/steps");
          })
        );
        yield* actEffect(SubscriptionRef.set(current, initial));
        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/borrow/complete");
          })
        );
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(router.state.location.pathname).toBe("/borrow/steps")
          )
        );
        expect(acquireExecution).toHaveBeenCalledTimes(1);
        app.unmount();
        router.dispose();
      })
  );
});
