import { Effect, type Scope } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import { makeScopedEffectAtom } from "../../../../app/runtime/scoped-effect-atom";
import { walletRuntime } from "../../../../app/runtime/wallet-runtime";
import {
  BorrowReviewConfirmationFailure,
  toBorrowReviewConfirmation,
  toBorrowReviewConfirmationFailure,
} from "../borrow-review-confirmation-error";
import type { BorrowFlowReviewHandle } from "../orchestration/borrow-flow-review";
import type { BorrowFlowSessionHandle } from "../orchestration/borrow-flow-session";

export const makeBorrowFlowReviewScopeAtom = <E>(
  sessionAtom: Atom.Atom<AsyncResult.AsyncResult<BorrowFlowSessionHandle, E>>
) =>
  makeScopedEffectAtom({
    acquire: (context) =>
      Effect.gen(function* (): Effect.fn.Return<
        BorrowFlowReviewHandle,
        E,
        Scope.Scope
      > {
        const session = yield* context.result(sessionAtom);
        return yield* session.acquireReview();
      }),
    label: "borrowFlowReviewScope",
    makeValue: (handleAtom) => {
      const confirmAtom = walletRuntime
        .fn(
          (_input: undefined, context) =>
            context.result(handleAtom).pipe(
              // Without a Review handle there is no action to explain.
              Effect.mapError(() =>
                BorrowReviewConfirmationFailure.cases.Failed.make({})
              ),
              Effect.flatMap((review) =>
                review
                  .confirm()
                  .pipe(Effect.mapError(toBorrowReviewConfirmationFailure))
              )
            ),
          { concurrent: false, initialValue: undefined }
        )
        .pipe(
          Atom.map(toBorrowReviewConfirmation),
          Atom.withLabel("confirmBorrowFlowReview")
        );
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
