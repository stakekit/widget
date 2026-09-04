import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer, Schema, SubscriptionRef } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { walletRuntime } from "../../src/app/runtime/wallet-runtime";
import { WalletAddress } from "../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import type {
  ClassicFlowSession,
  ClassicTransactionFlowIntake,
  StartClassicTransactionFlow,
} from "../../src/features/classic-transaction-flow/model/classic-transaction-flow";
import {
  currentClassicFlowSessionAtom,
  isActiveClassicTransactionFlowPathAtom,
  startClassicTransactionFlowAtom,
} from "../../src/features/classic-transaction-flow/state/atoms/classic-flow";
import { classicFlowSessionRootAtomFamily } from "../../src/features/classic-transaction-flow/state/atoms/classic-flow-session";
import type { ClassicFlowSessionHandle } from "../../src/features/classic-transaction-flow/state/orchestration/classic-flow-session";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { toWidgetPath } from "../../src/services/navigation/widget-navigation";
import { yieldApiYieldFixture } from "../fixtures";

const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({ address, network: "ethereum" });

const makeEnterIntake = (): Extract<
  ClassicTransactionFlowIntake,
  { readonly _tag: "Enter" }
> => {
  const selectedStake = yieldApiYieldFixture();
  return {
    _tag: "Enter",
    gasFeeToken: selectedStake.mechanics.gasFeeToken,
    providersDetails: [],
    request: {
      address,
      arguments: { amount: "1" },
      yieldId: selectedStake.id,
    },
    selectedStake,
    selectedToken: selectedStake.token,
    selectedValidators: new Map(),
    walletScope,
  };
};

const makeSession = (
  intake: ClassicTransactionFlowIntake,
  epoch: number
): ClassicFlowSession => {
  const mount = (() => {
    switch (intake._tag) {
      case "Enter":
        return { _tag: "Earn" } as const;
      case "Exit":
        return {
          _tag: "PositionExit",
          balanceId: "balance",
          integrationId: intake.integration.id,
        } as const;
      case "Manage":
        return {
          _tag: "PositionManage",
          balanceId: "balance",
          integrationId: intake.integration.id,
        } as const;
      case "YieldActionContinuation":
        return {
          _tag: "YieldActionContinuation",
        } as const;
    }
  })();

  return {
    destination: {
      completePath: toWidgetPath("/complete"),
      reviewPath: toWidgetPath("/review"),
      stepsPath: toWidgetPath("/steps"),
    },
    epoch,
    intake,
    mount,
  };
};

const makeSessionHandle = (
  session: ClassicFlowSession
): ClassicFlowSessionHandle => ({
  acquireExecution: () =>
    Effect.succeed({ _tag: "RejectedNoReservation" } as const),
  acquireReview: () => Effect.die("Review is outside this Atom bridge test"),
  intake: session.intake,
});

describe("Classic Flow Atom bridge", () => {
  it.effect(
    "looks up the service once, projects current state, and binds Session acquisition to the root Atom lifetime",
    () =>
      Effect.gen(function* () {
        const current = yield* SubscriptionRef.make<ClassicFlowSession | null>(
          null
        );
        const probes = { acquired: 0, released: 0 };
        const startInputs: Array<StartClassicTransactionFlow> = [];
        const service = ClassicTransactionFlowService.of({
          acquireSession: (session) =>
            Effect.acquireRelease(
              Effect.sync(() => {
                probes.acquired += 1;
                return {
                  _tag: "Acquired",
                  session: makeSessionHandle(session),
                } as const;
              }),
              () =>
                Effect.sync(() => {
                  probes.released += 1;
                }).pipe(Effect.andThen(SubscriptionRef.set(current, null)))
            ),
          currentSession: SubscriptionRef.changes(current),
          start: (input) =>
            Effect.gen(function* () {
              startInputs.push(input);
              const session = makeSession(input.intake, 1);
              yield* SubscriptionRef.set(current, session);
              return { _tag: "Started", session } as const;
            }),
        });
        const registry = AtomRegistry.make({
          initialValues: [
            Atom.initialValue(
              walletRuntime.layer,
              Layer.succeed(ClassicTransactionFlowService, service) as never
            ),
          ],
        });
        const intake = makeEnterIntake();
        const command = { intake, mount: { _tag: "Earn" } } as const;

        registry.set(startClassicTransactionFlowAtom, command);
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(currentClassicFlowSessionAtom)?.epoch).toBe(1)
          )
        );
        expect(startInputs).toEqual([command]);
        expect(
          registry.get(isActiveClassicTransactionFlowPathAtom("/review"))
        ).toBe(true);

        const session = registry.get(currentClassicFlowSessionAtom);
        if (!session) throw new Error("Expected a Classic Flow Session");
        const rootAtom = classicFlowSessionRootAtomFamily(session);
        const releaseRoot = registry.mount(rootAtom);
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(probes.acquired).toBe(1))
        );

        releaseRoot();
        yield* Effect.promise(() =>
          vi.waitFor(() => expect(probes.released).toBe(1))
        );
        yield* Effect.promise(() =>
          vi.waitFor(() =>
            expect(registry.get(currentClassicFlowSessionAtom)).toBeNull()
          )
        );
      })
  );
});
