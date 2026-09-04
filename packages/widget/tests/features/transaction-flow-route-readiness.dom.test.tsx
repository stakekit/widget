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
import * as Atom from "effect/unstable/reactivity/Atom";
import { act } from "react";
import { createMemoryRouter, Outlet, RouterProvider } from "react-router";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { Action } from "../../src/domain/borrow/execution/action";
import { IntegrationId, MarketId } from "../../src/domain/borrow/ids";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type { BorrowFlowSession } from "../../src/features/borrow-transaction-flow/model/borrow-transaction-flow";
import {
  BorrowTransactionFlowCompletionGuard,
  BorrowTransactionFlowExecutionScope,
  BorrowTransactionFlowRoute,
  useBorrowTransactionFlowExecution,
} from "../../src/features/borrow-transaction-flow/react/borrow-flow-route";
import { currentBorrowFlowSessionAtom } from "../../src/features/borrow-transaction-flow/state/atoms/borrow-flow";
import { BorrowTransactionFlowService } from "../../src/features/borrow-transaction-flow/state/orchestration/borrow-transaction-flow-service";
import type { ClassicFlowSession } from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import { ClassicFlowRoute } from "../../src/features/classic-transaction-flow/react/classic-flow-route";
import { currentClassicFlowSessionAtom } from "../../src/features/classic-transaction-flow/state/atoms/classic-flow";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { toWidgetPath } from "../../src/services/navigation/widget-navigation";
import { initializeTransactionWorkflow } from "../../src/services/transaction-workflow/internal/model";
import {
  BorrowTransactionWorkflowInput,
  type TransactionWorkflowState,
} from "../../src/services/transaction-workflow/transaction-workflow-model";
import { yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom.tsx";

const address = Schema.decodeSync(WalletAddress)("0xWallet");
const walletScope = new WalletScopeKey({ address, network: "ethereum" });
const selectedStake = yieldApiYieldFixture();
const classicSession: ClassicFlowSession = {
  epoch: 1,
  destination: {
    reviewPath: toWidgetPath("/review"),
    stepsPath: toWidgetPath("/steps"),
    completePath: toWidgetPath("/complete"),
  },
  mount: { _tag: "Earn" },
  intake: {
    _tag: "Enter",
    gasFeeToken: selectedStake.mechanics.gasFeeToken,
    providersDetails: [],
    request: { address, yieldId: selectedStake.id },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  },
};
const borrowSession: BorrowFlowSession = {
  epoch: 1,
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
};

const makeDelayedSession = Effect.fn("test.makeDelayedSession")(function* <A>(
  session: A
) {
  const current = yield* SubscriptionRef.make<A | null>(session);
  const ready = yield* Deferred.make<void>();
  return {
    current,
    ready,
    states: Stream.unwrap(
      Deferred.await(ready).pipe(Effect.as(SubscriptionRef.changes(current)))
    ),
  };
});

const actEffect = <A,>(effect: Effect.Effect<A>) =>
  Effect.promise(() =>
    act(async () => {
      // ast-grep-ignore: no-run-effect-in-test -- React act is a Promise-based boundary; keep Effect-driven React updates inside it.
      await Effect.runPromise(effect);
    })
  );

describe("Transaction Flow route admission", () => {
  it.live.each([
    { kind: "Classic", projection: "cold" },
    { kind: "Classic", projection: "retained null" },
    { kind: "Borrow", projection: "cold" },
    { kind: "Borrow", projection: "retained null" },
  ] as const)(
    "$kind waits for authoritative state with a $projection projection, and reads afresh on re-entry",
    ({ kind, projection }) =>
      Effect.gen(function* () {
        const classic = yield* makeDelayedSession(classicSession);
        const borrow = yield* makeDelayedSession(borrowSession);
        const acquired = vi.fn();
        const released = vi.fn();
        const classicService = ClassicTransactionFlowService.of({
          acquireSession: (session) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                acquired(session.epoch);
                return {
                  _tag: "Acquired",
                  session: {
                    intake: session.intake,
                    acquireReview: () => Effect.die("Not used"),
                    acquireExecution: () => Effect.die("Not used"),
                  },
                } as const;
              }),
              () => Effect.sync(() => released())
            ),
          currentSession: classic.states,
          start: () => Effect.die("Not used"),
        });
        const borrowService = BorrowTransactionFlowService.of({
          acquireSession: (session) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                acquired(session.epoch);
                return {
                  _tag: "Acquired",
                  session: {
                    intake: session.intake,
                    acquireReview: () => Effect.die("Not used"),
                    acquireExecution: () => Effect.die("Not used"),
                  },
                } as const;
              }),
              () => Effect.sync(() => released())
            ),
          currentSession: borrow.states,
          start: () => Effect.die("Not used"),
        });
        const router = createMemoryRouter(
          [
            { path: "/", element: <div>Entry</div> },
            { path: "/borrow", element: <div>Entry</div> },
            {
              element:
                kind === "Classic" ? (
                  <ClassicFlowRoute expected="Enter" />
                ) : (
                  <BorrowTransactionFlowRoute expected="BorrowEntry" />
                ),
              children: [{ path: "/review", element: <div>Review</div> }],
            },
          ],
          { initialEntries: ["/review"] }
        );
        const app = yield* Effect.promise(() =>
          render(
            <RegistryProvider
              initialValues={[
                Atom.initialValue(
                  walletRuntime.layer,
                  Layer.merge(
                    Layer.succeed(
                      ClassicTransactionFlowService,
                      classicService
                    ),
                    Layer.succeed(BorrowTransactionFlowService, borrowService)
                  ) as never
                ),
                ...(projection === "retained null"
                  ? [
                      Atom.initialValue(currentClassicFlowSessionAtom, null),
                      Atom.initialValue(currentBorrowFlowSessionAtom, null),
                    ]
                  : []),
              ]}
            >
              <RouterProvider router={router} />
            </RegistryProvider>
          )
        );

        expect(router.state.location.pathname).toBe("/review");
        expect(
          app.container.querySelector('[aria-busy="true"]')
        ).not.toBeNull();
        yield* actEffect(
          Effect.all([
            Deferred.succeed(classic.ready, undefined),
            Deferred.succeed(borrow.ready, undefined),
          ])
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(app.container.textContent).toBe("Review"))
        );
        expect(acquired).toHaveBeenCalledWith(1);

        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/");
          })
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(released).toHaveBeenCalledTimes(1))
        );
        yield* SubscriptionRef.set(classic.current, {
          ...classicSession,
          epoch: 2,
        });
        yield* SubscriptionRef.set(borrow.current, {
          ...borrowSession,
          epoch: 2,
        });
        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/review");
          })
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(acquired).toHaveBeenLastCalledWith(2))
        );
        expect(router.state.location.pathname).toBe("/review");

        yield* actEffect(
          Effect.all([
            SubscriptionRef.set(classic.current, null),
            SubscriptionRef.set(borrow.current, null),
          ])
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(app.container.textContent).toBe("Entry"))
        );
        // A fresh visit with genuinely absent authoritative state still redirects.
        yield* Effect.promise(() =>
          act(async () => {
            await router.navigate("/review");
          })
        );
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(app.container.textContent).toBe("Entry"))
        );
        expect(acquired).toHaveBeenCalledTimes(2);
        app.unmount();
        router.dispose();
      })
  );
});

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
              back: () => Effect.succeed({ _tag: "Accepted" as const }),
              finish: () => Effect.succeed({ _tag: "Accepted" as const }),
              runWorkflow: () => Effect.succeed({ _tag: "Accepted" as const }),
            },
          })
        );
        const service = BorrowTransactionFlowService.of({
          currentSession: Stream.concat(
            Stream.succeed(borrowSession),
            Stream.never
          ),
          start: () => Effect.die("Not used"),
          acquireSession: () =>
            Effect.succeed({
              _tag: "Acquired",
              session: {
                intake: borrowSession.intake,
                acquireExecution,
                acquireReview: () => Effect.die("Not used"),
              },
            }),
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
          { initialEntries: ["/borrow/steps"] }
        );
        const app = yield* Effect.promise(() =>
          render(
            <RegistryProvider
              initialValues={[
                Atom.initialValue(
                  walletRuntime.layer,
                  Layer.succeed(BorrowTransactionFlowService, service) as never
                ),
                Atom.initialValue(currentBorrowFlowSessionAtom, borrowSession),
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
