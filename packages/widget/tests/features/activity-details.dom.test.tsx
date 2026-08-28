import { DateTime } from "effect";
import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { ActivityActionItem } from "../../src/features/activity/model/activity-action";
import { ActivityDetailsPage } from "../../src/features/activity/ui/activity-details/activity-details.page";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import {
  yieldApiActionFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { render } from "../utils/test-utils.dom";

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
vi.mock("../../src/features/activity/react/activity-action-route", () => ({
  useActivityActionRoute: () => route.current,
}));
vi.mock("../../src/features/tracking/index", () => ({
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
} = {}): ActivityActionItem => {
  const yieldData = yieldApiYieldFixture();
  return {
    actionData: yieldApiActionFixture({
      amount: "1000000000000000.123456789",
      createdAt: DateTime.makeUnsafe("2026-08-26T10:00:00.000Z"),
      status,
      transactions: [
        yieldApiTransactionFixture({
          error: "Execution reverted",
          explorerUrl: "https://explorer.test/failed",
          status: "FAILED",
          title: "Stake",
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
  it("renders exact historical action data and opens a transaction link", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    route.current = {
      continuationReady: false,
      item: makeItem(),
      presentation: "Dashboard",
      providersDetails: [{ name: "StakeKit" }],
    };

    const app = await renderDetails();
    const explorer = Array.from(app.container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("View transaction")
    );

    expect(app.container.textContent).toContain("-1000000000000000.123456789");
    expect(app.container.textContent).toContain("Failed");
    expect(app.container.textContent).toContain("Execution reverted");
    expect(app.container.textContent).not.toContain("Continue");

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
});
