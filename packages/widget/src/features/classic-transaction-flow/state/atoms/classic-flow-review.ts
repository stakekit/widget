import { Cause, Data, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { makeScopedEffectStateAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { YieldAction } from "../../../../domain/schema/action-models";
import {
  CurrentYieldKycGateKey,
  currentYieldKycGateAtom,
  refreshCurrentYieldKycAtom,
} from "../../../yield-summary/state";
import {
  type ClassicFlowSession,
  getClassicTransactionFlowKycYield,
} from "../../model/classic-transaction-flow";
import {
  makeClassicFlowActivityActionExpiredAtom,
  makeClassicFlowSessionReviewResources,
} from "../../resources/classic-flow-review-resources";
import type { ClassicFlowReviewHandle } from "../orchestration/classic-flow-review";
import type { AcquireClassicFlowSessionOutcome } from "../orchestration/classic-transaction-flow-service";
import { makeClassicFlowStakeReviewViewAtom } from "../yield-summary";

class ClassicFlowScopeUnavailableError extends Data.TaggedError(
  "ClassicFlowScopeUnavailableError"
)<{
  readonly message: string;
  readonly retryable: false;
}> {}

const unavailable = () =>
  new ClassicFlowScopeUnavailableError({
    message: "The Classic Flow route no longer owns its Session.",
    retryable: false,
  });

export const makeClassicFlowReviewScopeAtom = <E>({
  session,
  sessionOutcomeAtom,
}: {
  readonly session: ClassicFlowSession;
  readonly sessionOutcomeAtom: Atom.Atom<
    AsyncResult.AsyncResult<AcquireClassicFlowSessionOutcome, E>
  >;
}) => {
  const intakeAtom = Atom.make(session.intake).pipe(
    Atom.withLabel("classicFlowSessionIntake")
  );
  const kycGateAtom = Atom.make((get) =>
    get(
      currentYieldKycGateAtom(
        new CurrentYieldKycGateKey({
          enabled: true,
          yieldDto: getClassicTransactionFlowKycYield(get(intakeAtom)),
        })
      )
    )
  ).pipe(Atom.withLabel("classicFlowSessionKycGate"));
  const refreshKycAtom = Atom.fnSync(
    (_input: undefined, get) => {
      get.set(
        refreshCurrentYieldKycAtom(
          new CurrentYieldKycGateKey({
            enabled: true,
            yieldDto: getClassicTransactionFlowKycYield(get(intakeAtom)),
          })
        ),
        undefined
      );
    },
    { initialValue: undefined }
  ).pipe(Atom.withLabel("refreshClassicFlowSessionKycAtom"));
  const activityActionExpiredAtom =
    session.intake._tag === "ActivityResume"
      ? makeClassicFlowActivityActionExpiredAtom(intakeAtom)
      : Atom.make(false).pipe(Atom.setIdleTTL(0));
  const eligibilityAtom = Atom.make((get) => ({
    activityExpired: get(activityActionExpiredAtom),
    kycBlocking: get(kycGateAtom).isGateBlocking,
  })).pipe(Atom.setIdleTTL(0), Atom.withLabel("classicFlowReviewEligibility"));

  return makeScopedEffectStateAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        ClassicFlowReviewHandle,
        E | ClassicFlowScopeUnavailableError,
        import("effect").Scope.Scope
      > {
        const outcome = yield* context.result(sessionOutcomeAtom);
        if (outcome._tag !== "Acquired") {
          return yield* unavailable();
        }
        return yield* outcome.session.acquireReview(
          AtomRegistry.toStream(context.registry, eligibilityAtom)
        );
      }),
    getStates: (review: ClassicFlowReviewHandle) => review.states,
    label: "classicFlowReviewScope",
    makeValue: ({ handleAtom, stateAtom }) => {
      const actionPreviewAtom = Atom.make((get) => {
        if (get(kycGateAtom).isGateBlocking) {
          return AsyncResult.success<YieldAction | null>(null);
        }

        const result = get(stateAtom);
        switch (result._tag) {
          case "Initial":
            return AsyncResult.initial<
              YieldAction | null,
              { retryable: boolean }
            >(result.waiting);
          case "Failure":
            return AsyncResult.failure<
              YieldAction | null,
              { retryable: boolean }
            >(
              Cause.map(result.cause, () => unavailable()),
              { waiting: result.waiting }
            );
          case "Success": {
            const { preview } = result.value;
            switch (preview._tag) {
              case "Initial":
              case "Loading":
                return AsyncResult.initial<
                  YieldAction | null,
                  { retryable: boolean }
                >(true);
              case "Success":
                return AsyncResult.success<
                  YieldAction | null,
                  { retryable: boolean }
                >(preview.action);
              case "Failure":
                return AsyncResult.fail<
                  typeof preview.error,
                  YieldAction | null
                >(preview.error);
            }
          }
        }
      }).pipe(
        Atom.setIdleTTL(0),
        Atom.withLabel("classicFlowReviewActionPreview")
      );

      const reviewResources = makeClassicFlowSessionReviewResources({
        actionPreviewAtom,
        activityActionExpiredAtom,
        intakeAtom,
        kycGateAtom,
      });
      const stakeReviewViewAtom =
        session.intake._tag === "Enter"
          ? makeClassicFlowStakeReviewViewAtom(
              session.intake,
              reviewResources.reviewViewAtom
            )
          : null;
      const reviewViewAtom = Atom.make((get) => ({
        ...get(reviewResources.reviewViewAtom),
        stake: stakeReviewViewAtom ? get(stakeReviewViewAtom) : null,
      })).pipe(Atom.withLabel("classicFlowSessionReviewViewAtom"));
      const confirmAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((review) => review.confirm())),
          { initialValue: undefined }
        )
        .pipe(
          Atom.setIdleTTL(0),
          Atom.withLabel("confirmClassicFlowReviewAtom")
        );

      return {
        availabilityAtom: handleAtom,
        facade: {
          activityReviewViewAtom: reviewResources.activityReviewViewAtom,
          confirmAtom,
          refreshKycAtom,
          reviewViewAtom,
        },
      } as const;
    },
    runtime: walletRuntime,
  });
};
