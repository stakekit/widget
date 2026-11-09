import { DateTime } from "effect";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";

import "../../../src/ui/theme/reset.css";
import type { ActionTransaction } from "../../../src/domain/earn/action-models";
import { TransactionHash } from "../../../src/domain/identity/identifiers";
import type { YieldActivityItem } from "../../../src/features/activity/model/activity-action";
import { ActivityDetailsPage } from "../../../src/features/activity/ui/activity-details/activity-details.page";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import {
  yieldApiActionFixture,
  yieldApiProviderFixture,
  yieldApiTransactionFixture,
  yieldApiYieldFixture,
} from "../../fixtures";

const route = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
const atomValue = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@effect/atom-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@effect/atom-react")>()),
  useAtomValue: () => atomValue.current,
}));
vi.mock("../../../src/features/activity/ui/activity-action-route", () => ({
  useActivityActionRoute: () => route.current,
}));
vi.mock("../../../src/features/tracking/index", () => ({
  useTrackEvent: () => vi.fn(),
  useTrackPage: vi.fn(),
}));

const i18n = createWidgetI18nInstance();

const confirmedTransaction = (id: string, stepIndex: number) =>
  yieldApiTransactionFixture({
    broadcastedAt: DateTime.makeUnsafe("2026-08-26T10:05:00.000Z"),
    explorerUrl: `https://explorer.test/${id}`,
    hash: TransactionHash.make(
      "0x03fa9b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7ee314"
    ),
    id,
    status: "CONFIRMED",
    stepIndex,
    type: stepIndex === 0 ? "APPROVAL" : "STAKE",
  });

const makeItem = (
  transactions: ReadonlyArray<ActionTransaction>
): YieldActivityItem => {
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
      transactions,
      type: "STAKE",
      yieldId: yieldData.id,
    }),
    validatorsData: [],
    walletScope: { network: "ethereum" } as never,
    yieldData,
  };
};

// The compact Widget's page width.
const Page = ({ children }: { readonly children: ReactNode }) => (
  <div style={{ containerType: "inline-size", width: 368 }}>{children}</div>
);

const renderDetails = (item: YieldActivityItem) => {
  atomValue.current = {
    now: DateTime.makeUnsafe("2026-08-27T10:00:00.000Z"),
    timeZone: DateTime.zoneMakeNamedUnsafe("UTC"),
  };
  route.current = {
    continuationReady: false,
    item,
    receiptPlacement: "page",
  };
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <Page>
          <ActivityDetailsPage />
        </Page>
      </MemoryRouter>
    </I18nextProvider>
  );
};

const isOneLine = (element: Element) =>
  element.getBoundingClientRect().height <
  Number.parseFloat(getComputedStyle(element).lineHeight) * 1.5;

describe("Activity details on the compact page", () => {
  it("shows each hash on one line beside its copy and explorer buttons", async () => {
    const app = await renderDetails(
      makeItem([confirmedTransaction("a", 0), confirmedTransaction("b", 1)])
    );
    const rows = Array.from(
      app.container.querySelectorAll<HTMLElement>(
        '[data-testid="activity-details-transaction"]'
      )
    );

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const hash = Array.from(row.querySelectorAll("span")).find(
        (element) => element.textContent === "0x03fa…e314"
      );
      if (hash === undefined) throw new Error("Expected the short hash");
      expect(isOneLine(hash)).toBe(true);
      expect(hash.scrollWidth).toBeLessThanOrEqual(hash.clientWidth);
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
      expect(
        row.querySelector('button[aria-label="Copy transaction hash"]')
      ).not.toBeNull();
    }
    await expect
      .element(app.getByRole("button", { name: "View Approval transaction" }))
      .toBeVisible();
    await expect
      .element(app.getByRole("button", { name: "View Stake transaction" }))
      .toBeVisible();
    // Several transactions have no single explorer page to lead to.
    expect(
      app.container.querySelectorAll(
        '[data-testid="activity-details-explorer"]'
      )
    ).toHaveLength(0);
  });
});
