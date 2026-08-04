import { Data, Effect } from "effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import type { BorrowFlowReviewHandle } from "../orchestration/borrow-flow-review";
import type { AcquireBorrowFlowSessionOutcome } from "../orchestration/borrow-transaction-flow-service";

class BorrowFlowReviewUnavailableError extends Data.TaggedError(
  "BorrowFlowReviewUnavailableError"
)<{ readonly message: string }> {}

const unavailable = () =>
  new BorrowFlowReviewUnavailableError({
    message: "The Borrow Flow route no longer owns its Session.",
  });

export const makeBorrowFlowReviewScopeAtom = <E>(
  sessionOutcomeAtom: Atom.Atom<
    AsyncResult.AsyncResult<AcquireBorrowFlowSessionOutcome, E>
  >
) =>
  makeScopedEffectAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        BorrowFlowReviewHandle,
        BorrowFlowReviewUnavailableError | E,
        import("effect").Scope.Scope
      > {
        const outcome = yield* context.result(sessionOutcomeAtom);
        if (outcome._tag !== "Acquired") return yield* unavailable();
        return yield* outcome.session.acquireReview();
      }),
    label: "borrowFlowReviewScope",
    makeValue: (handleAtom) => {
      const confirmAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((review) => review.confirm())),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(Atom.withLabel("confirmBorrowFlowReview"));
      const backAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context
              .result(handleAtom)
              .pipe(Effect.flatMap((review) => review.back())),
          { initialValue: undefined }
        )
        .pipe(Atom.withLabel("backBorrowFlowReview"));

      return {
        availabilityAtom: handleAtom,
        facade: { backAtom, confirmAtom },
      } as const;
    },
    runtime: walletRuntime,
  });
