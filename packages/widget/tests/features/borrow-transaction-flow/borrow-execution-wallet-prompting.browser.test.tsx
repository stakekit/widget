import { describe, expect, it } from "@effect/vitest";
import { Deferred, Effect } from "effect";
import { userEvent } from "vitest/browser";
import type { Connector } from "wagmi";

import { BorrowStepsPage } from "../../../src/features/borrow-transaction-flow/ui/steps";
import { AccountModal } from "../../../src/features/wallet/views";
import { WalletRequestCancelledError } from "../../../src/services/wallet/wallet-errors";
import { makeBorrowApi, wallet } from "./borrow-execution-harness";
import { renderExecution } from "./render-borrow-execution";

describe("borrow execution flow: wallet prompting", () => {
  it.live(
    "asks before Cancel leaves Steps while the wallet holds the transaction",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          stepsElement: <BorrowStepsPage />,
          wallet: {
            ...wallet,
            signTransaction: () => Effect.never,
          },
        });
        const cancel = () =>
          Effect.promise(() =>
            userEvent.click(app.getByRole("button", { name: "Cancel" }))
          );

        yield* cancel();
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Stay" }))
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByText("Leave this transaction?"))
            .not.toBeInTheDocument()
        );
        expect(app.getByText("Borrow home").query()).toBeNull();

        yield* cancel();
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Leave" }))
        );
        yield* Effect.promise(() =>
          expect.element(app.getByText("Borrow home")).toBeInTheDocument()
        );
      })
  );

  it.live(
    "asks to approve the transaction in the named wallet while it signs",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          stepsElement: <BorrowStepsPage />,
          wallet: {
            ...wallet,
            signTransaction: () => Effect.never,
          },
        });

        const prompt = app.getByTestId("flow-steps-signature-prompt");
        yield* Effect.promise(() =>
          expect
            .poll(() => prompt.element().textContent ?? "")
            .toContain("Test Wallet")
        );
        // No gas is estimated before a borrow's steps run.
        expect(app.getByTestId("steps-details-gas").query()).toBeNull();
      })
  );

  it.live(
    "asks to approve without naming the host's External Provider when it signs",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          stepsElement: <BorrowStepsPage />,
          wallet: {
            ...wallet,
            signTransaction: () => Effect.never,
          },
          walletConnector: {
            id: "externalProviderConnector",
            name: "External Provider",
            uid: "external",
          } as Connector,
        });

        const prompt = app.getByTestId("flow-steps-signature-prompt");
        yield* Effect.promise(() =>
          expect.poll(() => prompt.element().textContent ?? "").toMatch(/\S/)
        );
        expect(prompt.element().textContent).not.toContain("External Provider");
        // No connector logo is shown for the host's provider.
        expect(prompt.element().querySelector("img")).toBeNull();
      })
  );

  it.live(
    "drops a held question once the wallet declines, and never asks it again on retry",
    () =>
      Effect.gen(function* () {
        const declined = yield* Deferred.make<void>();
        let signAttempts = 0;
        const app = yield* renderExecution(makeBorrowApi({}), {
          historyControls: true,
          stepsElement: <BorrowStepsPage />,
          wallet: {
            ...wallet,
            signTransaction: () =>
              Effect.suspend(() => {
                signAttempts += 1;
                return signAttempts === 1
                  ? Deferred.await(declined).pipe(
                      Effect.andThen(
                        Effect.fail(
                          new WalletRequestCancelledError({
                            operation: "transaction",
                          })
                        )
                      )
                    )
                  : Effect.never;
              }),
          },
        });
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("history-path"))
            .toHaveTextContent("/borrow/steps")
        );

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("leave-confirmation")).toBeVisible()
        );

        // Nothing was signed, so the question no longer applies.
        yield* Deferred.succeed(declined, undefined);
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("leave-confirmation"))
            .not.toBeInTheDocument()
        );

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Try again" }))
        );
        yield* Effect.promise(() => expect.poll(() => signAttempts).toBe(2));
        // Wait until Steps is guarded again before checking nothing reopened.
        yield* Effect.promise(() =>
          expect
            .poll(() => {
              const event = new Event("beforeunload", { cancelable: true });
              window.dispatchEvent(event);
              return event.defaultPrevented;
            })
            .toBe(true)
        );
        expect(app.getByTestId("leave-confirmation").query()).toBeNull();

        // A new navigation asks again, and Leave carries that one out.
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Back" }))
        );
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

  it.live("asks the browser before unloading only while signing", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });
      const unload = () => {
        const event = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      };

      yield* Effect.promise(() => expect.poll(unload).toBe(true));

      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Cancel" }))
      );
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Leave" }))
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow home")).toBeInTheDocument()
      );
      yield* Effect.promise(() => expect.poll(unload).toBe(false));
    })
  );

  it.live("leaves at once when the user declined before signing anything", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () =>
            Effect.fail(
              new WalletRequestCancelledError({ operation: "transaction" })
            ),
        },
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Try again" }))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Cancel" }))
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow home")).toBeInTheDocument()
      );
      expect(app.getByText("Leave this transaction?").query()).toBeNull();
    })
  );

  it.live("asks before a wallet disconnect ends a signing Steps", () =>
    Effect.gen(function* () {
      let logouts = 0;
      const logout = Effect.sync(() => {
        logouts += 1;
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        stepsElement: (
          <>
            <AccountModal triggerSize="sm" />
            <BorrowStepsPage />
          </>
        ),
        wallet: {
          ...wallet,
          logout,
          signTransaction: () => Effect.never,
        },
      });
      const disconnect = () =>
        Effect.promise(() =>
          userEvent.click(app.getByTestId("wallet-account-disconnect"))
        );

      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: /0001$/ }))
      );
      yield* disconnect();
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Stay" }))
      );
      // Staying returns to the account dialog without disconnecting.
      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("wallet-account-dialog"))
          .toBeInTheDocument()
      );
      expect(logouts).toBe(0);

      yield* disconnect();
      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Leave" }))
      );
      yield* Effect.promise(() => expect.poll(() => logouts).toBe(1));
    })
  );
});
