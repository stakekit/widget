import { describe, expect, it } from "@effect/vitest";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/models";
import { getYieldFlowTransactionsToSign } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import {
  getLockupPeriodFact,
  getSignaturesFact,
  getUnlockPeriodFact,
} from "../../../src/features/yield-transaction-flow/ui/review/hooks/review-facts";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  confidentialYieldFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const t = createWidgetI18nInstance().getFixedT("en");

const withPeriods = (
  yieldDto: EarnYieldWithProvider,
  periods: {
    readonly cooldownSeconds?: number;
    readonly lockupSeconds?: number;
  }
): EarnYieldWithProvider => ({
  ...yieldDto,
  mechanics: {
    ...yieldDto.mechanics,
    ...(periods.cooldownSeconds === undefined
      ? {}
      : { cooldownPeriod: { seconds: periods.cooldownSeconds } }),
    ...(periods.lockupSeconds === undefined
      ? {}
      : { lockupPeriod: { seconds: periods.lockupSeconds } }),
  },
});

describe("getUnlockPeriodFact", () => {
  it("shows a cooldown under a day in hours, never as instant", () => {
    expect(
      getUnlockPeriodFact(
        withPeriods(yieldApiYieldFixture(), { cooldownSeconds: 6 * 3600 }),
        t
      ).value
    ).toBe("6 hours");
  });

  it("shows a cooldown of days in days", () => {
    expect(
      getUnlockPeriodFact(
        withPeriods(yieldApiYieldFixture(), { cooldownSeconds: 7 * 86400 }),
        t
      ).value
    ).toBe("7 days");
  });

  it("shows a yield without a cooldown as instant", () => {
    expect(getUnlockPeriodFact(yieldApiYieldFixture(), t).value).toBe(
      "Instant"
    );
  });

  it("keeps the unlock period for a confidential vault", () => {
    expect(
      getUnlockPeriodFact(
        withPeriods(confidentialYieldFixture(), { cooldownSeconds: 3600 }),
        t
      ).value
    ).toBe("1 hour");
  });
});

describe("getLockupPeriodFact", () => {
  it("shows the yield's lockup", () => {
    expect(
      getLockupPeriodFact(
        withPeriods(yieldApiYieldFixture(), { lockupSeconds: 30 * 86400 }),
        t
      )
    ).toMatchObject({ label: "Lock-up period", value: "30 days" });
  });

  it("shows nothing without a lockup", () => {
    expect(getLockupPeriodFact(yieldApiYieldFixture(), t)).toBeNull();
  });
});

describe("getYieldFlowTransactionsToSign", () => {
  it("counts a planned conversion first and leaves out confirmed transactions", () => {
    const transactions = getYieldFlowTransactionsToSign(
      {
        transactions: [
          yieldApiTransactionFixture({ status: "CONFIRMED", type: "APPROVAL" }),
          yieldApiTransactionFixture({ status: "CREATED", type: "STAKE" }),
        ],
      },
      [{ type: "RESET_APPROVAL" }, { type: "APPROVAL" }, { type: "WRAP" }]
    );

    expect(transactions).toEqual([
      "RESET_APPROVAL",
      "APPROVAL",
      "WRAP",
      "STAKE",
    ]);
    expect(getSignaturesFact({ loading: false, t, transactions })).toEqual({
      caption: "Reset approval, Approval, Wrap, Stake",
      label: "Wallet signatures",
      testId: "review-signatures",
      value: "4",
    });
  });

  it("shows no signatures fact once nothing is left to sign", () => {
    expect(
      getSignaturesFact({
        loading: false,
        t,
        transactions: getYieldFlowTransactionsToSign(
          {
            transactions: [yieldApiTransactionFixture({ status: "CONFIRMED" })],
          },
          []
        ),
      })
    ).toBeNull();
  });
});
