import { describe, expect, it, vi } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { userEvent } from "vitest/browser";

import { BorrowStepsPage } from "../../../src/features/borrow-transaction-flow/ui/steps";
import {
  decodedAction,
  makeBorrowApi,
  transactionHash,
  wallet,
} from "./borrow-execution-harness";
import { renderExecution } from "./render-borrow-execution";

describe("borrow execution flow: route history", () => {
  it.live("asks before history navigation leaves a signing Steps", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        historyControls: true,
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });
      const back = () =>
        Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("history-path"))
          .toHaveTextContent("/borrow/steps")
      );

      yield* back();
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Stay" }))
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Leave this transaction?"))
          .not.toBeInTheDocument()
      );
      expect(app.getByTestId("history-path").element()).toHaveTextContent(
        "/borrow/steps"
      );

      yield* back();
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Leave" }))
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("history-path"))
          .toHaveTextContent("/borrow/review")
      );
    })
  );

  it.live(
    "returns to a fresh Review without resuming an abandoned workflow from browser history",
    () =>
      Effect.gen(function* () {
        const confirmationInterrupted = yield* Deferred.make<void>();
        const signTransaction = vi.fn(() =>
          Effect.succeed({
            broadcasted: true as const,
            signedTx: transactionHash,
          })
        );
        const borrow = makeBorrowApi({});
        borrow.getAction.mockImplementation(() =>
          Effect.never.pipe(
            Effect.onInterrupt(() =>
              Deferred.succeed(confirmationInterrupted, undefined)
            )
          )
        );
        const activeWallet = { ...wallet, signTransaction };
        const app = yield* renderExecution(borrow, {
          action: decodedAction(),
          historyControls: true,
          initialEntries: ["/borrow", "/borrow/review"],
          initialIndex: 1,
          stepsElement: <BorrowStepsPage />,
          wallet: activeWallet,
        });

        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/steps")
        );

        yield* Effect.promise(() =>
          vi.waitFor(() => {
            expect(signTransaction).toHaveBeenCalledOnce();
            expect(borrow.submitTransaction).toHaveBeenCalledOnce();
            expect(borrow.getAction).toHaveBeenCalledOnce();
          })
        );

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
        // The broadcast transaction is confirming, so leaving asks first.
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Leave" }))
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/review")
        );
        yield* Deferred.await(confirmationInterrupted);

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow")
        );
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Forward" }))
        );
        // Forward reopens Review with a fresh Session; execution needs a new Confirm.
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/review")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("start-execution")).toBeInTheDocument()
        );

        expect(
          app.container.querySelector('[data-rk="borrow-steps-page"]')
        ).not.toBeInTheDocument();
        expect(signTransaction).toHaveBeenCalledOnce();
        expect(borrow.submitTransaction).toHaveBeenCalledOnce();
      })
  );
});
