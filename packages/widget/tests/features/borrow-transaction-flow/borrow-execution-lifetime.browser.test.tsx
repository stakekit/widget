import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { userEvent } from "vitest/browser";
import { BorrowCompletePage } from "../../../src/features/borrow-transaction-flow/ui/complete";
import { BorrowStepsPage } from "../../../src/features/borrow-transaction-flow/ui/steps";
import {
  WalletOwnerMismatchError,
  WalletRequestCancelledError,
} from "../../../src/services/wallet/wallet-errors";
import {
  disconnectedNormalizedWalletState,
  type NormalizedWalletState,
} from "../../../src/services/wallet/wallet-state";
import {
  action,
  connectedWalletState,
  decodedAction,
  enableCollateralSession,
  makeBorrowApi,
  renderExecution,
  transaction,
  transactionHash,
  wallet,
  withdrawSession,
} from "./borrow-execution-harness";

describe("borrow execution flow: execution and lifetime", () => {
  it.live(
    "leaves Steps after hash submission fails and registers the held hash",
    () =>
      Effect.gen(function* () {
        const borrow = makeBorrowApi({ failFirstSubmit: true });
        const app = yield* renderExecution(borrow, {
          stepsElement: <BorrowStepsPage />,
        });

        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText("The transaction couldn't be sent. Try again.")
            )
            .toBeInTheDocument()
        );
        expect(app.container.textContent).not.toContain(
          "Borrow transaction could not be submitted."
        );
        // Sent, the transaction can no longer be cancelled: the footer
        // offers Leave.
        expect(app.getByRole("button", { name: "Cancel" }).query()).toBeNull();
        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Leave" }))
        );
        // Borrow actions are not continued from Activity.
        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText(
                "Your transaction is in progress. If you leave now, its remaining steps won't be completed."
              )
            )
            .toBeInTheDocument()
        );
        // A sent transaction is guarded even after its submission failed.
        yield* Effect.promise(() =>
          userEvent.click(
            app
              .getByTestId("leave-confirmation")
              .getByRole("button", { name: "Leave" })
          )
        );
        yield* Effect.promise(() =>
          expect.element(app.getByText("Borrow home")).toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .poll(() => borrow.submitTransactionInBackground)
            .toHaveBeenCalledOnce()
        );
        expect(borrow.submitTransaction).toHaveBeenCalledOnce();
        expect(borrow.submitTransactionInBackground).toHaveBeenCalledWith({
          command: { transactionHash },
          transactionId: "tx-1",
        });
      })
  );

  it.live("labels steps with human-readable transaction types", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        action: decodedAction({
          action: "disableCollateral",
          transactions: [transaction({ type: "DISABLE_COLLATERAL" })],
        }),
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        expect
          .poll(() => app.container.textContent)
          .toContain("Disable collateral")
      );
      expect(app.container.textContent).not.toContain("DISABLE_COLLATERAL");
    })
  );

  it.live("renders each borrow transaction as a step in a timeline", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        action: decodedAction({
          transactions: [
            transaction({ id: "tx-1", type: "APPROVAL" }),
            transaction({ id: "tx-2", type: "SUPPLY" }),
          ],
        }),
        stepsElement: <BorrowStepsPage />,
        wallet: {
          ...wallet,
          signTransaction: () => Effect.never,
        },
      });

      yield* Effect.promise(() =>
        expect
          .poll(() => app.container.textContent)
          .toContain("Step 1 of 2 · Token approval")
      );
      yield* Effect.promise(() =>
        expect
          .poll(() => app.container.textContent)
          .toContain("Step 2 of 2 · Supply")
      );
      // The signing step of the first transaction is active.
      yield* Effect.promise(() =>
        expect
          .poll(() =>
            Array.from(app.container.querySelectorAll("ol > li"), (step) =>
              step.getAttribute("aria-current")
            ).slice(0, 2)
          )
          .toEqual(["step", null])
      );
      expect(app.container.textContent).not.toContain("Transaction history");
    })
  );

  it.live("shows that the next action step is being prepared", () =>
    Effect.gen(function* () {
      const borrow = makeBorrowApi({
        getActions: [
          action({
            hasNextStep: true,
            totalSteps: 2,
            transactions: [transaction({ status: "CONFIRMED" })],
          }),
        ],
      });
      borrow.stepAction.mockImplementation(() => Effect.never);
      const app = yield* renderExecution(borrow, {
        action: decodedAction({ hasNextStep: true, totalSteps: 2 }),
        stepsElement: <BorrowStepsPage />,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Preparing the next step"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Step 1 of 2")).toBeInTheDocument()
      );
    })
  );

  it.live("routes to success when execution completes", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "SUCCESS",
              transactions: [transaction({ status: "CONFIRMED" })],
            }),
          ],
        })
      );

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
    })
  );

  it.live(
    "moves on to Complete without asking once the workflow completes",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(
          makeBorrowApi({
            getActions: [
              action({
                status: "SUCCESS",
                transactions: [transaction({ status: "CONFIRMED" })],
              }),
            ],
          }),
          // Steps is leave-guarded from signing through confirming.
          { stepsElement: <BorrowStepsPage /> }
        );

        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("complete"))
            .toHaveTextContent("/borrow/complete action-1")
        );
        expect(app.getByText("Leave this transaction?").query()).toBeNull();
      })
  );

  it.live("labels every completed transaction with its type", () =>
    Effect.gen(function* () {
      const transactions = [
        transaction({ id: "tx-1", type: "APPROVAL" }),
        transaction({ id: "tx-2", type: "SUPPLY" }),
        transaction({ id: "tx-3", type: "BORROW" }),
      ];
      // The provider confirms one transaction per poll; reporting the action
      // SUCCESS early would leave the rest unsigned (batch reconciliation).
      const confirmedThrough = (count: number) =>
        transactions.map((tx, index) => ({
          ...tx,
          status:
            index < count
              ? ("CONFIRMED" as const)
              : ("WAITING_FOR_SIGNATURE" as const),
        }));
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "PROCESSING",
              transactions: confirmedThrough(1),
            }),
            action({
              status: "PROCESSING",
              transactions: confirmedThrough(2),
            }),
            action({
              status: "SUCCESS",
              transactions: confirmedThrough(3),
            }),
          ],
        }),
        {
          action: decodedAction({ transactions }),
          completeElement: <BorrowCompletePage />,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow complete")).toBeInTheDocument()
      );
      for (const label of ["Token approval", "Supply", "Borrow"]) {
        yield* Effect.promise(() =>
          expect
            .element(
              app.getByRole("link", {
                name: new RegExp(`^View ${label} transaction`),
              })
            )
            .toBeInTheDocument()
        );
      }
      expect(app.container.textContent).not.toContain("View on explorer");
    })
  );

  it.live("titles completion with the action that ran", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              action: "withdraw",
              status: "SUCCESS",
              transactions: [
                transaction({ status: "CONFIRMED", type: "WITHDRAW" }),
              ],
            }),
          ],
        }),
        {
          action: decodedAction({
            action: "withdraw",
            transactions: [transaction({ type: "WITHDRAW" })],
          }),
          completeElement: <BorrowCompletePage />,
          session: withdrawSession,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Withdrawal complete")).toBeInTheDocument()
      );
      expect(app.container.textContent).not.toContain("Borrow complete");
    })
  );

  it.live("names the asset a collateral toggle completed for", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              action: "enableCollateral",
              status: "SUCCESS",
              transactions: [
                transaction({ status: "CONFIRMED", type: "ENABLE_COLLATERAL" }),
              ],
            }),
          ],
        }),
        {
          action: decodedAction({
            action: "enableCollateral",
            transactions: [transaction({ type: "ENABLE_COLLATERAL" })],
          }),
          completeElement: <BorrowCompletePage />,
          session: enableCollateralSession,
        }
      );

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("WETH enabled as collateral"))
          .toBeInTheDocument()
      );
    })
  );

  it.live("titles an execution failure with the action that ran", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              action: "withdraw",
              status: "PROCESSING",
              transactions: [
                transaction({ status: "FAILED", type: "WITHDRAW" }),
              ],
            }),
          ],
        }),
        {
          action: decodedAction({
            action: "withdraw",
            transactions: [transaction({ type: "WITHDRAW" })],
          }),
          session: withdrawSession,
          stepsElement: <BorrowStepsPage />,
        }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText("Withdrawal failed")).toBeInTheDocument()
      );
      expect(app.container.textContent).not.toContain(
        "Borrow transaction failed"
      );
    })
  );

  it.live(
    "says the collateral went in when the borrow after it failed, never the raw status",
    () =>
      Effect.gen(function* () {
        const supply = transaction({ id: "tx-supply", type: "SUPPLY" });
        const borrowTx = transaction({ id: "tx-borrow", type: "BORROW" });
        const app = yield* renderExecution(
          makeBorrowApi({
            getActions: [
              action({
                status: "WAITING_FOR_NEXT",
                transactions: [{ ...supply, status: "CONFIRMED" }, borrowTx],
              }),
              action({
                status: "FAILED",
                transactions: [
                  { ...supply, status: "CONFIRMED" },
                  { ...borrowTx, status: "FAILED" },
                ],
              }),
            ],
          }),
          {
            action: decodedAction({
              action: "supplyAndBorrow",
              transactions: [supply, borrowTx],
            }),
            stepsElement: <BorrowStepsPage />,
          }
        );

        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText(
                "Your 0.5 cbBTC was supplied as collateral, but the borrow didn't go through. Try the borrow again, or withdraw the collateral from your position."
              )
            )
            .toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByText("The transaction failed. Try again."))
            .toBeInTheDocument()
        );
        expect(app.container.textContent).not.toContain("FAILED status");
      })
  );

  it.live(
    "says the collateral went in when the user declined the borrow after it, without calling it a failure",
    () =>
      Effect.gen(function* () {
        const supply = transaction({ id: "tx-supply", type: "SUPPLY" });
        const borrowTx = transaction({ id: "tx-borrow", type: "BORROW" });
        let signAttempts = 0;
        const app = yield* renderExecution(
          makeBorrowApi({
            getActions: [
              action({
                status: "WAITING_FOR_NEXT",
                transactions: [{ ...supply, status: "CONFIRMED" }, borrowTx],
              }),
            ],
          }),
          {
            action: decodedAction({
              action: "supplyAndBorrow",
              transactions: [supply, borrowTx],
            }),
            stepsElement: <BorrowStepsPage />,
            wallet: {
              ...wallet,
              signTransaction: (...args) => {
                signAttempts += 1;
                return signAttempts === 1
                  ? wallet.signTransaction(...args)
                  : Effect.fail(
                      new WalletRequestCancelledError({
                        operation: "transaction",
                      })
                    );
              },
            },
          }
        );

        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText(
                "Your 0.5 cbBTC was supplied as collateral, but the borrow didn't go through. Try the borrow again, or withdraw the collateral from your position."
              )
            )
            .toBeInTheDocument()
        );
        expect(app.container.textContent).not.toContain("Borrow failed");
      })
  );

  it.live("renders retryable failure and routes after retry succeeds", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "PROCESSING",
              transactions: [transaction({ status: "FAILED" })],
            }),
            action({
              status: "SUCCESS",
              transactions: [transaction({ status: "CONFIRMED" })],
            }),
          ],
        })
      );

      yield* Effect.promise(() =>
        expect.element(app.getByTestId("retry")).toBeInTheDocument()
      );

      yield* Effect.promise(() => userEvent.click(app.getByTestId("retry")));

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
    })
  );

  it.live("retries after reconnecting without signing twice", () =>
    Effect.gen(function* () {
      let state: NormalizedWalletState = disconnectedNormalizedWalletState;
      const signTransaction = vi.fn((_input: unknown) =>
        Effect.succeed({
          broadcasted: true as const,
          signedTx: transactionHash,
        })
      );
      const reconnectingWallet = {
        ...wallet,
        state: Effect.sync(() => ({
          connection: state,
          ledger: {
            accounts: [],
            currentAccountId: undefined,
            disabledChains: [],
          },
        })),
        // WalletService checks the expected owner on the signing command
        // itself and signs nothing while the wallet is disconnected.
        signTransaction: (input: unknown) =>
          state.status === "connected"
            ? signTransaction(input)
            : Effect.fail(
                new WalletOwnerMismatchError({
                  operation: "transaction",
                  reason: "disconnected",
                })
              ),
      };
      const app = yield* renderExecution(
        makeBorrowApi({
          getActions: [
            action({
              status: "SUCCESS",
              transactions: [transaction({ status: "CONFIRMED" })],
            }),
          ],
        }),
        { wallet: reconnectingWallet }
      );

      yield* Effect.promise(() =>
        expect.element(app.getByTestId("retry")).toBeInTheDocument()
      );
      expect(signTransaction).not.toHaveBeenCalled();

      state = connectedWalletState;
      yield* Effect.promise(() => userEvent.click(app.getByTestId("retry")));

      yield* Effect.promise(() =>
        expect
          .element(app.getByTestId("complete"))
          .toHaveTextContent("/borrow/complete action-1")
      );
      expect(signTransaction).toHaveBeenCalledOnce();
    })
  );

  it.live(
    "shows the next action step while retaining prior transaction batches",
    () =>
      Effect.gen(function* () {
        let signCalls = 0;
        const multiStepWallet = {
          ...wallet,
          signTransaction: () => {
            signCalls += 1;
            return signCalls === 1
              ? Effect.succeed({
                  broadcasted: true as const,
                  signedTx: transactionHash,
                })
              : Effect.never;
          },
        };
        const first = decodedAction({
          hasNextStep: true,
          totalSteps: 2,
        });
        const app = yield* renderExecution(
          makeBorrowApi({
            getActions: [
              action({
                hasNextStep: true,
                totalSteps: 2,
                transactions: [transaction({ status: "CONFIRMED" })],
              }),
            ],
            stepActions: [
              action({
                currentStep: 2,
                id: first.id,
                totalSteps: 2,
                transactions: [transaction({ id: "tx-2" })],
              }),
            ],
          }),
          { action: first, wallet: multiStepWallet }
        );

        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("action-step"))
            .toHaveTextContent("2/2")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("batch-count")).toHaveTextContent("2")
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByTestId("current-transaction"))
            .toHaveTextContent("tx-2")
        );
        yield* Effect.promise(() =>
          expect.element(app.getByTestId("phase")).toHaveTextContent("signing")
        );
      })
  );
});
