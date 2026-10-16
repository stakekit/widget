import { DateTime, Schema } from "effect";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { BorrowActivityAction } from "../../../src/domain/borrow/responses";
import type {
  BorrowActivityItem,
  YieldActivityItem,
} from "../../../src/features/activity/model/activity-action";
import { ActivityDetailsPage } from "../../../src/features/activity/ui/activity-details/activity-details.page";
import { ActivityDetailsFailure } from "../../../src/features/activity/ui/activity-details/activity-details-status";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { render } from "../../utils/test-utils.dom";

const route = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const trackEvent = vi.hoisted(() => vi.fn());
const trackPage = vi.hoisted(() => vi.fn());
const atomValue = vi.hoisted(() => ({ current: null as unknown }));
const presentationTime = {
  now: DateTime.makeUnsafe("2026-08-27T10:00:00.000Z"),
  timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
};

vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@effect/atom-react")>()),
  useAtomValue: () => atomValue.current,
}));
vi.mock("../../../src/features/activity/react/activity-action-route", () => ({
  useActivityActionRoute: () => route.current,
}));
vi.mock("../../../src/features/tracking/index", () => ({
  useTrackEvent: () => trackEvent,
  useTrackPage: (page: string) => trackPage(page),
}));

const i18n = createWidgetI18nInstance();

const makeItem = ({
  status = "FAILED",
  withYield = true,
}: {
  readonly status?: "FAILED" | "WAITING_FOR_NEXT";
  readonly withYield?: boolean;
} = {}): YieldActivityItem => {
  const yieldData = yieldApiYieldFixture();
  return {
    _tag: "yield",
    actionData: yieldApiActionFixture({
      amount: "1000000000000000.123456789",
      createdAt: DateTime.makeUnsafe("2026-08-26T10:00:00.000Z"),
      status,
      transactions: [
        yieldApiTransactionFixture({
          error: "Execution reverted",
          explorerUrl: "https://explorer.test/failed",
          hash: "0x1234567890abcdef1234",
          id: "stake",
          status: "FAILED",
          stepIndex: 1,
          type: "STAKE",
        }),
        yieldApiTransactionFixture({
          id: "approval",
          status: "CONFIRMED",
          stepIndex: 0,
          type: "APPROVAL",
        }),
      ],
      type: "UNSTAKE",
      yieldId: yieldData.id,
    }),
    validatorsData: [],
    walletScope: { network: "ethereum" } as never,
    yieldData: withYield ? yieldData : null,
  };
};

const renderDetails = async () => {
  atomValue.current = presentationTime;
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ActivityDetailsPage />
      </MemoryRouter>
    </I18nextProvider>
  );
};

describe("Activity details receipt", () => {
  it("renders historical action data and opens a transaction link", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    route.current = {
      continuationReady: false,
      item: makeItem(),
      presentation: "Dashboard",
      providersDetails: [{ name: "StakeKit" }],
    };

    const app = await renderDetails();
    const rows = Array.from(
      app.container.querySelectorAll('[data-rk="activity-details-transaction"]')
    );
    const explorer = app.container.querySelector<HTMLButtonElement>(
      'button[aria-label="View Stake transaction"]'
    );

    expect(app.container.textContent).toContain("-1,000,000,000,000,000.12");
    expect(app.container.textContent).toContain("1 failed");
    expect(app.container.textContent).not.toContain("Continue");
    expect(rows.map((row) => row.textContent)).toEqual([
      "1. ApprovalConfirmed",
      "2. StakeFailed · Execution reverted0x1234…1234",
    ]);
    expect(rows[0]?.tagName).not.toBe("BUTTON");
    expect(
      explorer
        ?.getAttribute("aria-describedby")
        ?.split(" ")
        .map(
          (id) =>
            document.getElementById(id)?.getAttribute("aria-label") ??
            document.getElementById(id)?.textContent
        )
    ).toEqual(["Failed", "Failed · Execution reverted"]);

    await act(async () => explorer?.click());
    expect(open).toHaveBeenCalledWith("https://explorer.test/failed", "_blank");
    expect(trackEvent).toHaveBeenCalledWith("viewTxClicked");
    expect(trackPage).toHaveBeenCalledWith("unstakeReview");
    open.mockRestore();
  });

  it("keeps the receipt available when Yield metadata is missing", async () => {
    route.current = {
      continuationReady: false,
      item: makeItem({ status: "WAITING_FOR_NEXT", withYield: false }),
      presentation: "Classic",
      providersDetails: [],
    };

    const app = await renderDetails();

    expect(app.container.textContent).toContain(
      "This action cannot continue because its yield details are unavailable."
    );
    expect(app.container.textContent).not.toContain("Continue");
  });

  it("renders a Borrow receipt without continuation", async () => {
    trackPage.mockClear();
    const item: BorrowActivityItem = {
      _tag: "borrow",
      actionData: Schema.decodeSync(BorrowActivityAction)({
        action: "supplyAndBorrow",
        address: "0x0000000000000000000000000000000000000001",
        createdAt: "2026-08-26T10:00:00.000Z",
        id: "borrow-action",
        integrationId: "morpho-borrow",
        metadata: {
          currentHealthFactor: null,
          currentLtv: "0",
          originationFeeAmount: "1.2",
          predictedHealthFactor: "1.6",
          predictedLtv: "0.5",
        },
        rawArguments: { amount: "100", marketId: "morpho-weth-usdc" },
        status: "SUCCESS",
        transactions: [
          {
            id: "approval",
            network: "ethereum",
            status: "CONFIRMED",
            type: "APPROVAL",
          },
        ],
      }),
      integration: {
        name: "Morpho Borrow",
      } as BorrowActivityItem["integration"],
      // Only the pair label and loan token are read by the receipt.
      market: {
        collateralTokens: [{ token: { symbol: "WETH" } }],
        loanToken: { symbol: "USDC" },
        type: "isolated",
      } as unknown as BorrowActivityItem["market"],
      network: "ethereum",
      token: null,
      walletScope: { network: "ethereum" } as never,
    };
    route.current = {
      continuationReady: false,
      item,
      presentation: "Dashboard",
      providersDetails: [],
    };

    const app = await renderDetails();
    const text = app.container.textContent;

    expect(text).toContain("Supplied and borrowed");
    expect(text).toContain("via Morpho · Ethereum");
    expect(text).toContain("MarketWETH / USDC");
    expect(text).toContain("Origination fee1.2 USDC");
    expect(text).toContain("LTV0% → 50%");
    expect(text).toContain("Health factor1.6");
    expect(text).not.toContain("Continue");
    expect(
      Array.from(
        app.container.querySelectorAll(
          '[data-rk="activity-details-transaction"]'
        )
      ).map((row) => row.textContent)
    ).toEqual(["1. Token approvalConfirmed"]);
    expect(trackPage).not.toHaveBeenCalled();
  });

  it("shows a retryable failure when the action cannot be loaded", async () => {
    const onRetry = vi.fn();
    const app = await render(
      <I18nextProvider i18n={i18n}>
        <ActivityDetailsFailure onRetry={onRetry} />
      </I18nextProvider>
    );
    const retry = Array.from(app.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Try Again"
    );

    expect(app.container.textContent).toContain("Something went wrong");
    await act(async () => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
