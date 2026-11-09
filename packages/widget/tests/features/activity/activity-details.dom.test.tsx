import { DateTime, Schema } from "effect";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { BorrowActivityAction } from "../../../src/domain/borrow/responses";
import { TransactionHash } from "../../../src/domain/identity/identifiers";
import type {
  BorrowActivityItem,
  YieldActivityItem,
} from "../../../src/features/activity/model/activity-action";
import { ActivityDetailsFailure } from "../../../src/features/activity/ui/activity-details/activity-details-status";
import { ActivityDetailsPage } from "../../../src/features/activity/ui/activity-details/activity-details.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  yieldApiActionFixture,
  yieldApiProviderFixture,
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
vi.mock("../../../src/features/activity/ui/activity-action-route", () => ({
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
          hash: TransactionHash.make("0x1234567890abcdef1234"),
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

const makeCompletedItem = (): YieldActivityItem => {
  const yieldData = {
    ...yieldApiYieldFixture(),
    provider: yieldApiProviderFixture({ name: "Lido" }),
  };
  return {
    _tag: "yield",
    actionData: yieldApiActionFixture({
      amount: "1",
      amountUsd: "2400",
      completedAt: DateTime.makeUnsafe("2026-08-26T10:06:00.000Z"),
      createdAt: DateTime.makeUnsafe("2026-08-26T10:00:00.000Z"),
      status: "SUCCESS",
      transactions: [
        yieldApiTransactionFixture({
          broadcastedAt: DateTime.makeUnsafe("2026-08-26T10:05:00.000Z"),
          explorerUrl: "https://explorer.test/a",
          hash: TransactionHash.make(
            "0x03fa9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7ee314"
          ),
          id: "a",
          status: "CONFIRMED",
          stepIndex: 0,
          type: "APPROVAL",
        }),
      ],
      type: "STAKE",
      yieldId: yieldData.id,
    }),
    validatorsData: [],
    walletScope: { network: "ethereum" } as never,
    yieldData,
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
      receiptPlacement: "page",
    };

    const app = await renderDetails();
    const rows = Array.from(
      app.container.querySelectorAll(
        '[data-testid="activity-details-transaction"]'
      )
    );
    const explorer = app.container.querySelector<HTMLButtonElement>(
      'button[aria-label="View Stake transaction"]'
    );

    expect(app.container.textContent).toContain("\u22121000T ETH");
    expect(app.container.textContent).toContain("1 failed");
    expect(app.container.textContent).not.toContain("Continue");
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
    ).toEqual(["Failed", "The contract rejected this transaction"]);

    // The raw error the network reported stays one press away.
    const errorDetails = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="activity-details-error-details"]'
    );
    expect(errorDetails?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => errorDetails?.click());
    expect(errorDetails?.getAttribute("aria-expanded")).toBe("true");
    expect(rows[1]?.textContent).toContain("Execution reverted");

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
      receiptPlacement: "page",
    };

    const app = await renderDetails();

    expect(app.container.textContent).toContain(
      "This action cannot continue because its yield details are unavailable."
    );
    expect(app.container.textContent).not.toContain("Continue");
  });

  it("names a waiting action by what it will do", async () => {
    route.current = {
      continuationReady: false,
      item: makeItem({ status: "WAITING_FOR_NEXT" }),
      receiptPlacement: "page",
    };

    const app = await renderDetails();
    const text = app.container.textContent;

    expect(app.container.querySelector("h2")?.textContent).toMatch(
      /^Withdraw /
    );
    expect(text).not.toContain("Withdrew");
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
        metadata: {},
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
      receiptPlacement: "pane",
    };

    const app = await renderDetails();
    const text = app.container.textContent;

    expect(text).toContain("Supplied and borrowed");
    expect(text).not.toContain("Continue");
    expect(trackPage).not.toHaveBeenCalled();
  });

  it("heads with the action and lists its facts, without a back control", async () => {
    route.current = {
      continuationReady: false,
      item: makeCompletedItem(),
      receiptPlacement: "page",
    };

    const app = await renderDetails();
    const text = app.container.textContent;
    const heading = app.container.querySelector("h2");

    expect(heading?.textContent).toBe("Deposited ETH");
    expect(text).toContain("+1 ETH");
    expect(text).toContain("$2,400.00");
    for (const [label, value] of [
      ["Status", "Completed"],
      ["Network", "Ethereum"],
      ["Provider", "Lido"],
      ["Created", "Aug 26, 2026, 10:00 AM"],
      ["Completed", "Aug 26, 2026, 10:06 AM"],
    ]) {
      expect(text).toContain(`${label}${value}`);
    }
    // The shell's back button leads back; the receipt draws no second one.
    expect(
      app.container.querySelectorAll('button[aria-label*="Back"]')
    ).toHaveLength(0);
    // A completed action needs no status badge in the head.
    expect(heading?.parentElement?.textContent).toBe("Deposited ETH");
  });

  it("leads a single transaction to its explorer page", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    route.current = {
      continuationReady: false,
      item: makeCompletedItem(),
      receiptPlacement: "page",
    };

    const app = await renderDetails();
    const explorer = app.container.querySelector<HTMLButtonElement>(
      '[data-testid="activity-details-explorer"]'
    );

    expect(explorer?.textContent).toBe("View on explorer");
    await act(async () => explorer?.click());
    expect(open).toHaveBeenCalledWith("https://explorer.test/a", "_blank");
    open.mockRestore();
  });

  it("shows a retryable failure when the action cannot be loaded", async () => {
    const onRetry = vi.fn();
    const app = await render(
      <I18nextProvider i18n={i18n}>
        <ActivityDetailsFailure onRetry={onRetry} />
      </I18nextProvider>
    );
    const retry = Array.from(app.container.querySelectorAll("button")).find(
      (button) => button.textContent === "Try again"
    );

    expect(app.container.textContent).toContain("Something went wrong");
    await act(async () => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
