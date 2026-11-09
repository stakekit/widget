import { describe, expect, it, vi } from "@effect/vitest";
import { Effect } from "effect";
import { act } from "react";

import { BorrowFlowSession } from "../../../src/features/borrow-transaction-flow/model/session";
import { BorrowReviewPage } from "../../../src/features/borrow-transaction-flow/ui/review";
import { ApiRequestError } from "../../../src/services/api/resource-sources";
import { render } from "../../utils/test-utils.dom";
import {
  type BorrowApi,
  command,
  decodedAction,
  type ExecutionOptions,
  makeBorrowApi,
  makeExecutionApp,
  session,
} from "./borrow-execution-harness";

const renderReview = (
  borrow: BorrowApi,
  options: Pick<ExecutionOptions, "action" | "session"> = {}
) =>
  Effect.gen(function* () {
    const element = yield* makeExecutionApp(borrow, {
      ...options,
      reviewElement: <BorrowReviewPage />,
    });
    const app = yield* Effect.acquireRelease(
      Effect.promise(() => render(element)),
      (app) => Effect.sync(() => app.unmount())
    );
    const text = () => app.container.textContent ?? "";
    const confirmButton = () =>
      [...app.container.querySelectorAll("button")].find(
        (button) => button.textContent === "Confirm"
      );

    return { container: app.container, confirmButton, text };
  });

const eventually = (assertion: () => void) =>
  Effect.promise(() => vi.waitFor(assertion));

const confirm = (button: HTMLButtonElement | undefined) =>
  Effect.promise(() =>
    act(async () => {
      button?.click();
    })
  );

describe("Borrow Review presentation", () => {
  it.live(
    "shows localized confirmation feedback without internal error details",
    () =>
      Effect.gen(function* () {
        const review = yield* renderReview(makeBorrowApi({}), {
          action: decodedAction({ status: "FAILED" }),
        });

        yield* eventually(() => expect(review.confirmButton()).toBeDefined());
        yield* confirm(review.confirmButton());

        yield* eventually(() => {
          expect(review.text()).toContain("Borrow failed");
          expect(review.text()).toContain(
            "We couldn't prepare this transaction. Please try again."
          );
        });
        expect(review.text()).not.toContain(
          "Borrow action ended with FAILED status."
        );
      })
  );

  it.live("shows the API's reason when it refuses to create the action", () =>
    Effect.gen(function* () {
      const reason =
        "Insufficient WETH balance to repay the full debt: you have 0.0001 WETH but need at least 0.00010006 WETH.";
      const borrow = makeBorrowApi({});
      const review = yield* renderReview(borrow);
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

      yield* eventually(() => expect(review.confirmButton()).toBeDefined());
      yield* confirm(review.confirmButton());

      yield* eventually(() => expect(review.text()).toContain(reason));
      expect(review.text()).not.toContain(
        "We couldn't prepare this transaction. Please try again."
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
      const review = yield* renderReview(makeBorrowApi({}), {
        session: repaySession,
      });

      // The repaid amount heads Review, with the debt it clears in USD.
      yield* eventually(() =>
        expect(
          [...review.container.querySelectorAll("h1, h2, h3")].map(
            (heading) => heading.textContent
          )
        ).toContain("Repay USDC")
      );
      expect(review.text()).toContain("25 USDC");
      expect(review.text()).toContain("$25.00");
      expect(review.text()).not.toContain("Borrow amount");
    })
  );

  it.live("titles Review with the action, asset, provider and network", () =>
    Effect.gen(function* () {
      const review = yield* renderReview(makeBorrowApi({}));

      yield* eventually(() => {
        expect(review.text()).toContain("Borrow USDC");
        expect(review.text()).toContain("Morpho Blue · Base");
        expect(review.text()).toContain("cbBTC / USDC");
      });
      expect(review.text()).not.toContain(command.args.marketId);
    })
  );

  it.live("leaves the gas fee to the wallet and links the terms", () =>
    Effect.gen(function* () {
      const review = yield* renderReview(makeBorrowApi({}));

      // The action is built on Confirm, so the wallet quotes its gas.
      yield* eventually(() => {
        const gas = review.container.querySelector(
          '[data-testid="borrow-review-gas-fee"]'
        )?.textContent;
        expect(gas).toContain("Gas fee");
        expect(gas).toContain("Estimated in your wallet");
      });
      expect(
        review.container.querySelector(
          'a[href="https://docs.yield.xyz/docs/terms-of-use"]'
        )?.textContent
      ).toMatch(/Terms of Use/);
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
      const review = yield* renderReview(makeBorrowApi({}), {
        session: toggleSession,
      });

      yield* eventually(() => {
        expect(review.text()).toContain("Disable USDC as collateral");
        expect(review.text()).toContain("Aave V3 · Ethereum");
      });
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
      const review = yield* renderReview(makeBorrowApi({}), {
        session: riskSession,
      });

      yield* eventually(() => {
        expect(review.text()).toContain("40% → 50%");
        expect(review.text()).toContain("2 → 1.5");
      });
    })
  );

  it.live("keeps the fee rows and Confirm when risk is unavailable", () =>
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
      const review = yield* renderReview(makeBorrowApi({}), {
        session: unavailableSession,
      });

      yield* eventually(() => {
        expect(review.text()).toContain("0.025 cbBTC");
        expect(review.text()).toContain("0.475 cbBTC");
      });
      expect(review.confirmButton()?.disabled).toBe(false);
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
      const review = yield* renderReview(makeBorrowApi({}), {
        session: warnedSession,
      });

      yield* eventually(() => {
        expect(review.text()).toContain("Review warning");
        expect(review.text()).toMatch(
          /exceeds the currently known borrow capacity/
        );
      });
      expect(review.confirmButton()?.disabled).toBe(false);
    })
  );

  const blockedSession = (reason: "healthFactor" | "ltv") =>
    new BorrowFlowSession({
      walletScope: session.walletScope,
      intake: {
        ...session.intake,
        riskVerdict: { _tag: "Block", reason },
      },
    });

  it.live("blocks Confirm on a health factor Block verdict", () =>
    Effect.gen(function* () {
      const review = yield* renderReview(makeBorrowApi({}), {
        session: blockedSession("healthFactor"),
      });

      yield* eventually(() =>
        expect(review.text()).toMatch(/health factor would fall below 1/)
      );
      expect(review.confirmButton()?.disabled).toBe(true);
    })
  );

  it.live("blocks Confirm on an LTV Block verdict", () =>
    Effect.gen(function* () {
      const review = yield* renderReview(makeBorrowApi({}), {
        session: blockedSession("ltv"),
      });

      yield* eventually(() =>
        expect(review.text()).toMatch(/LTV would exceed the market's max LTV/)
      );
      expect(review.confirmButton()?.disabled).toBe(true);
    })
  );

  it.live(
    "decides Confirm from the carried verdict, not the displayed risk figures",
    () =>
      Effect.gen(function* () {
        const review = yield* renderReview(makeBorrowApi({}), {
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

        yield* eventually(() => expect(review.confirmButton()).toBeDefined());
        expect(review.confirmButton()?.disabled).toBe(false);
      })
  );
});
