import { Effect, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { YieldAction } from "../../../../domain/action/models";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import type { ClassicTransactionWorkflowProviderDetail } from "../../../../services/transaction-workflow/transaction-workflow-model";
import {
  isClassicFlowSessionPath,
  type StartClassicTransactionFlow,
} from "../../model/classic-transaction-flow";
import { ClassicTransactionFlowService } from "../orchestration/classic-transaction-flow-service";

export const classicTransactionFlowServiceAtom = walletRuntime
  .atom(Effect.service(ClassicTransactionFlowService))
  .pipe(Atom.keepAlive, Atom.withLabel("classicTransactionFlowServiceAtom"));

const currentClassicFlowSessionResultAtom = walletRuntime
  .atom((context) =>
    Stream.unwrap(
      context
        .result(classicTransactionFlowServiceAtom)
        .pipe(Effect.map((service) => service.currentSession))
    )
  )
  .pipe(Atom.keepAlive, Atom.withLabel("currentClassicFlowSessionResultAtom"));

export const currentClassicFlowSessionAtom = Atom.make((get) =>
  AsyncResult.getOrElse(get(currentClassicFlowSessionResultAtom), () => null)
).pipe(Atom.withLabel("currentClassicFlowSessionAtom"));

export const currentYieldActionContinuationIdAtom = Atom.make((get) => {
  const session = get(currentClassicFlowSessionAtom);
  return session?.intake._tag === "YieldActionContinuation"
    ? session.intake.action.id
    : null;
}).pipe(Atom.withLabel("currentYieldActionContinuationIdAtom"));

export const startClassicTransactionFlowAtom = walletRuntime
  .fn((input: StartClassicTransactionFlow, context) =>
    context
      .result(classicTransactionFlowServiceAtom)
      .pipe(Effect.flatMap((service) => service.start(input)))
  )
  .pipe(Atom.withLabel("startClassicTransactionFlowAtom"));

export type StartYieldActionContinuation = Readonly<{
  readonly action: YieldAction;
  readonly providersDetails: ReadonlyArray<ClassicTransactionWorkflowProviderDetail>;
  readonly selectedValidators: ReadonlyArray<EarnValidator>;
  readonly selectedYield: EarnYieldWithProvider;
  readonly walletScope: WalletScopeKey;
}>;

export const startYieldActionContinuationAtom = walletRuntime
  .fn((input: StartYieldActionContinuation, context) =>
    context.result(classicTransactionFlowServiceAtom).pipe(
      Effect.flatMap((service) =>
        service.start({
          intake: {
            _tag: "YieldActionContinuation",
            action: input.action,
            providersDetails: input.providersDetails,
            selectedValidators: input.selectedValidators,
            selectedYield: input.selectedYield,
            walletScope: input.walletScope,
          },
          mount: {
            _tag: "YieldActionContinuation",
          },
        })
      )
    )
  )
  .pipe(Atom.withLabel("startYieldActionContinuationAtom"));

export const isActiveClassicTransactionFlowPathAtom = Atom.family(
  (pathname: string) =>
    Atom.make((get) => {
      const session = get(currentClassicFlowSessionAtom);
      return session ? isClassicFlowSessionPath(session, pathname) : false;
    }).pipe(Atom.withLabel("isActiveClassicTransactionFlowPath"))
);
