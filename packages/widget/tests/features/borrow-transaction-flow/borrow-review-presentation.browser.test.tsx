import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { userEvent } from "vitest/browser";

import { BorrowFlowSession } from "../../../src/features/borrow-transaction-flow/model/session";
import { BorrowReviewPage } from "../../../src/features/borrow-transaction-flow/ui/review";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import {
  command,
  decodedAction,
  makeBorrowApi,
  renderExecution,
  session,
} from "./borrow-execution-harness";

describe("borrow execution flow: Review presentation", () => {
  it.live(
    "shows localized confirmation feedback without internal error details",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          action: decodedAction({ status: "FAILED" }),
          autoStart: false,
          reviewElement: <BorrowReviewPage />,
        });

        yield* Effect.promise(() =>
          userEvent.click(app.getByRole("button", { name: "Confirm" }))
        );

        yield* Effect.promise(() =>
          expect.element(app.getByText("Borrow failed")).toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .element(
              app.getByText(
                "We couldn't prepare this transaction. Please try again."
              )
            )
            .toBeInTheDocument()
        );
        yield* Effect.promise(() =>
          expect
            .element(app.getByText("Borrow action ended with FAILED status."))
            .not.toBeInTheDocument()
        );
      })
  );

  it.live("shows the API's reason when it refuses to create the action", () =>
    Effect.gen(function* () {
      const reason =
        "Insufficient WETH balance to repay the full debt: you have 0.0001 WETH but need at least 0.00010006 WETH.";
      const borrow = makeBorrowApi({});
      const app = yield* renderExecution(borrow, {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
      });
      borrow.executeAction.mockImplementation(() =>
        Effect.fail(
          new ApiRequestError({
            cause: undefined,
            failure: {
              _tag: "ErrorStatus",
              body: { message: reason },
              status: 412,
            },
            operation: "borrow-action-create",
          })
        )
      );

      yield* Effect.promise(() =>
        userEvent.click(app.getByRole("button", { name: "Confirm" }))
      );

      yield* Effect.promise(() =>
        expect.element(app.getByText(reason)).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(
            app.getByText(
              "We couldn't prepare this transaction. Please try again."
            )
          )
          .not.toBeInTheDocument()
      );
    })
  );

  it.live("heads Review with the repaid amount and its USD value", () =>
    Effect.gen(function* () {
      const repaySession = new BorrowFlowSession({
        walletScope: session.walletScope,
        intake: {
          ...session.intake,
          command: {
            ...session.intake.command,
            action: "repay",
            args: {
              amount: "25",
              marketId: command.args.marketId,
              ...(command.args.tokenAddress === undefined
                ? {}
                : { tokenAddress: command.args.tokenAddress }),
            },
          },
          summary: {
            action: "repay",
            borrowAmount: "25",
            existingDebtUsd: "400",
            loanTokenSymbol: "USDC",
            marketLabel: "cbBTC / USDC",
            network: "base",
            projectedDebtUsd: "375",
            providerName: "Morpho Blue",
            riskStatus: "available",
            projectedLtv: "0.25",
            warnings: [],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: repaySession,
      });

      // The repaid amount heads Review, with the debt it clears in USD.
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("heading", { name: "Repay USDC" }))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("25 USDC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("$25.00")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow amount")).not.toBeInTheDocument()
      );
    })
  );

  it.live("titles Review with the action, asset, provider and network", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Borrow USDC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Morpho Blue · Base")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("cbBTC / USDC")).toBeInTheDocument()
      );
      const text = app.container.textContent ?? "";
      expect(text).not.toContain("Requested action");
      expect(text).not.toContain(command.args.marketId);
      expect(text).not.toContain("Confirming will open");
    })
  );

  it.live("leaves the gas fee to the wallet and links the terms", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
      });

      // The action is built on Confirm, so the wallet quotes its gas.
      const gas = app.getByTestId("borrow-review-gas-fee");
      yield* Effect.promise(() =>
        expect.element(gas.getByText("Gas fee")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(gas.getByText("Estimated in your wallet"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("link", { name: /Terms of Use/ }))
          .toHaveAttribute("href", "https://docs.yield.xyz/docs/terms-of-use")
      );
    })
  );

  it.live("titles a collateral toggle with its asset", () =>
    Effect.gen(function* () {
      const toggleSession = new BorrowFlowSession({
        walletScope: session.walletScope,
        intake: {
          ...session.intake,
          summary: {
            action: "disableCollateral",
            collateralTokenSymbol: "USDC",
            existingCollateralUsd: "100",
            marketLabel: "USDC",
            network: "ethereum",
            providerName: "Aave V3",
            riskStatus: "unavailable",
            warnings: [],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: toggleSession,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Disable USDC as collateral"))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("Aave V3 · Ethereum")).toBeInTheDocument()
      );
    })
  );

  it.live("shows current to projected risk on Review", () =>
    Effect.gen(function* () {
      const riskSession = new BorrowFlowSession({
        walletScope: session.walletScope,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            currentHealthFactor: "2",
            currentLtv: "0.4",
            projectedHealthFactor: "1.5",
            projectedLtv: "0.5",
            riskStatus: "available",
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: riskSession,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("40% → 50%")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("2 → 1.5")).toBeInTheDocument()
      );
    })
  );

  it.live("omits projected metrics when risk is unavailable", () =>
    Effect.gen(function* () {
      const unavailableSession = new BorrowFlowSession({
        walletScope: session.walletScope,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            riskStatus: "unavailable",
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: unavailableSession,
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByText("Projected risk unavailable"))
          .not.toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("0.025 cbBTC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect.element(app.getByText("0.475 cbBTC")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeEnabled()
      );
    })
  );

  it.live("shows known constraint warnings without blocking Confirm", () =>
    Effect.gen(function* () {
      const warnedSession = new BorrowFlowSession({
        walletScope: session.walletScope,
        intake: {
          ...session.intake,
          summary: {
            ...session.intake.summary,
            warnings: ["RiskCapacityExceeded"],
          },
        },
      });
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: warnedSession,
      });

      yield* Effect.promise(() =>
        expect.element(app.getByText("Review warning")).toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/exceeds the currently known borrow capacity/))
          .toBeInTheDocument()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeEnabled()
      );
    })
  );

  it.live("blocks Confirm on a health factor Block verdict", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: new BorrowFlowSession({
          walletScope: session.walletScope,
          intake: {
            ...session.intake,
            riskVerdict: { _tag: "Block", reason: "healthFactor" },
          },
        }),
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeDisabled()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/health factor would fall below 1/))
          .toBeInTheDocument()
      );
    })
  );

  it.live("blocks Confirm on an LTV Block verdict", () =>
    Effect.gen(function* () {
      const app = yield* renderExecution(makeBorrowApi({}), {
        autoStart: false,
        reviewElement: <BorrowReviewPage />,
        session: new BorrowFlowSession({
          walletScope: session.walletScope,
          intake: {
            ...session.intake,
            riskVerdict: { _tag: "Block", reason: "ltv" },
          },
        }),
      });

      yield* Effect.promise(() =>
        expect
          .element(app.getByRole("button", { name: "Confirm" }))
          .toBeDisabled()
      );
      yield* Effect.promise(() =>
        expect
          .element(app.getByText(/LTV would exceed the market's max LTV/))
          .toBeInTheDocument()
      );
    })
  );

  it.live(
    "decides Confirm from the carried verdict, not the displayed risk figures",
    () =>
      Effect.gen(function* () {
        const app = yield* renderExecution(makeBorrowApi({}), {
          autoStart: false,
          reviewElement: <BorrowReviewPage />,
          session: new BorrowFlowSession({
            walletScope: session.walletScope,
            intake: {
              ...session.intake,
              riskVerdict: { _tag: "Allow" },
              summary: {
                ...session.intake.summary,
                maxLtv: "0.75",
                projectedHealthFactor: "0.8",
                projectedLtv: "0.9",
                riskStatus: "available",
              },
            },
          }),
        });

        yield* Effect.promise(() =>
          expect
            .element(app.getByRole("button", { name: "Confirm" }))
            .toBeEnabled()
        );
      })
  );
});
