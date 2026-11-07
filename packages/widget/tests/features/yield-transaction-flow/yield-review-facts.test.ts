import { describe, expect, it } from "@effect/vitest";
import type { EarnYieldWithProvider } from "../../../src/domain/earn/models";
import { exactDecimal } from "../../../src/domain/finance/exact";
import { getYieldFlowTransactionsToSign } from "../../../src/features/yield-transaction-flow/model/yield-transaction-workflow";
import {
  getLockupPeriodFact,
  getNetworkFeeWarning,
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

describe("getNetworkFeeWarning", () => {
  const warn = (
    feeUsd: string | null,
    valueUsd: string | null,
    subject: "amount" | "rewards" = "rewards"
  ) =>
    getNetworkFeeWarning({
      feeUsd: feeUsd === null ? null : exactDecimal(feeUsd),
      subject,
      t,
      valueUsd: valueUsd === null ? null : exactDecimal(valueUsd),
    });

  it("warns when the fee is higher than the rewards to claim", () => {
    expect(warn("0.52", "0.12")).toEqual({
      message: "The network fee is higher than the rewards you'd claim.",
      title: "High network fee",
    });
  });

  it("warns from half of the value", () => {
    expect(warn("0.5", "1")).toEqual({
      message: "The network fee is more than half the rewards you'd claim.",
      title: "High network fee",
    });
    expect(warn("2", "3", "amount")?.message).toBe(
      "The network fee is more than half the amount of this transaction."
    );
    expect(warn("3", "3", "amount")?.message).toBe(
      "The network fee is higher than the amount of this transaction."
    );
  });

  it("stays quiet below half of the value", () => {
    expect(warn("0.49", "1")).toBeNull();
  });

  it.each([
    ["the fee", null, "1"],
    ["the value", "0.5", null],
    ["a zero value", "0.5", "0"],
  ])("stays quiet without the USD of %s", (_, feeUsd, valueUsd) => {
    expect(warn(feeUsd, valueUsd)).toBeNull();
  });
});
