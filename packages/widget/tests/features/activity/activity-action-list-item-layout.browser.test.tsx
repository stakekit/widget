import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import "../../../src/ui/theme/reset.css";
import { ActionListItem } from "../../../src/features/activity/ui/activity-page/components/action-list-item";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, values?: { readonly providerName?: string }) =>
        values?.providerName ? `via ${values.providerName}` : key,
    }),
  };
});

const listItems = {
  completed: {
    amount: "1,234,567.891",
    amountSign: "+",
    direction: "deposit",
    providersDetails: [{ name: "The Ape Foundation Liquid Staking" }],
    statusLabel: "completed",
    statusText: "Completed",
    timestamp: "2:14 PM",
    title: "Deposited Wrapped Staked Ether",
    token: { name: "Wrapped Staked Ether", symbol: "wstETH" },
    amountTokenSymbol: "wstETH",
    amountFiat: "$3,086,419,727.50",
    amountText: "+1,234,567.891 wstETH",
    voided: false,
  },
  failed: {
    amount: "1",
    amountSign: "\u2212",
    direction: "withdraw",
    providersDetails: [{ name: "Lido" }],
    statusLabel: "failed",
    statusText: "Failed",
    timestamp: "Ended 21m ago",
    title: "Withdrew POL",
    token: { name: "Polygon", symbol: "POL" },
    amountTokenSymbol: "POL",
    amountFiat: null,
    amountText: "\u22121 POL",
    voided: true,
  },
  processing: {
    amount: "0.001",
    amountSign: "+",
    direction: "deposit",
    providersDetails: [{ name: "StakeKit" }],
    statusLabel: "processing",
    statusText: "Processing",
    timestamp: "just now",
    title: "Deposited POL",
    token: { name: "Polygon", symbol: "POL" },
    amountTokenSymbol: "POL",
    amountFiat: null,
    amountText: "+0.001 POL",
    voided: false,
  },
  // A Yield the API no longer lists: no token, no provider.
  unknownToken: {
    amount: "0.1",
    amountSign: "+",
    direction: "deposit",
    providersDetails: [],
    statusLabel: "completed",
    statusText: "Completed",
    timestamp: "9:03 AM",
    title: "Deposited",
    token: null,
    amountTokenSymbol: null,
    amountFiat: "$0.14",
    amountText: "+$0.14",
    voided: false,
  },
} as const;

type ListItemCase = keyof typeof listItems;

vi.mock(
  "../../../src/features/activity/ui/activity-page/hooks/use-action-list-item",
  () => ({
    useActionListItem: (action: { readonly case: ListItemCase }) =>
      listItems[action.case],
  })
);

// The mocked hook projects the row from its case alone.
const actionFor = (listItemCase: ListItemCase): never =>
  ({ case: listItemCase }) as never;

// A size container of a fixed width, as the Widget root and the feed's list are.
const SizeContainer = ({
  width,
  children,
}: {
  readonly width: number;
  readonly children: ReactNode;
}) => <div style={{ containerType: "inline-size", width }}>{children}</div>;

const findExactText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll<HTMLElement>("span")).find(
    (element) => element.textContent === text
  );

// One line box tall: less than two line heights.
const isOneLine = (element: HTMLElement) =>
  element.getBoundingClientRect().height <
  Number.parseFloat(getComputedStyle(element).lineHeight) * 1.5;

const renderRows = (width: number) =>
  render(
    <SizeContainer width={width}>
      {(Object.keys(listItems) as ReadonlyArray<ListItemCase>).map(
        (listItemCase) => (
          <ActionListItem
            key={listItemCase}
            action={actionFor(listItemCase)}
            onActionSelect={vi.fn()}
          />
        )
      )}
    </SizeContainer>
  );

const rowsOf = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLElement>(
      '[data-testid="activity-list-item"]'
    )
  );

describe("activity rows", () => {
  it.for([400, 720])(
    "keeps every row two lines tall at %ipx, with nothing wrapping",
    async (width) => {
      const app = await renderRows(width);
      const rows = rowsOf(app.container);
      const heights = rows.map((row) => row.getBoundingClientRect().height);

      expect(rows).toHaveLength(4);
      expect(new Set(heights).size).toBe(1);
      for (const row of rows) {
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
        for (const text of row.querySelectorAll<HTMLElement>("span")) {
          // An avatar's initials are its artwork, not a line of text.
          if (text.closest('[aria-hidden="true"]')) continue;
          if (text.childElementCount === 0 && text.textContent) {
            expect(isOneLine(text), text.textContent).toBe(true);
          }
        }
      }
      const amount = findExactText(app.container, "+1,234,567.891 wstETH");
      expect(amount?.checkVisibility()).toBe(true);
    }
  );

  it("puts the action beside its amount over the provider and status beside the time", async () => {
    const app = await renderRows(400);
    const [completed, failed, processing, unknownToken] = rowsOf(app.container);

    // Each row leads with its token's initials, its logo standing in for
    // them; a row without a token leads with what the action did.
    expect(completed?.textContent).toBe(
      "WDeposited Wrapped Staked Ether" +
        "via The Ape Foundation Liquid Staking" +
        "+1,234,567.891 wstETH2:14 PM"
    );
    // One status says it failed; the amount it never moved is struck.
    expect(failed?.textContent).toBe(
      "PWithdrew POLvia Lido·Failed\u22121 POLEnded 21m ago"
    );
    expect(processing?.textContent).toBe(
      "PDeposited POLvia StakeKit·Processing+0.001 POLjust now"
    );
    // A bare "+0.1" would not say of what, so the row shows its USD value.
    expect(unknownToken?.textContent).toBe("Deposited+$0.149:03 AM");
    const top = (text: string) =>
      findExactText(app.container, text)?.getBoundingClientRect().top;
    // Each line's start and end share a baseline row.
    expect(top("\u22121 POL")).toBeCloseTo(
      top("Withdrew POL") ?? Number.NaN,
      0
    );
    expect(top("Ended 21m ago")).toBeCloseTo(top("via Lido") ?? Number.NaN, 0);
    const struck = (text: string) => {
      const element = findExactText(app.container, text);
      return element ? getComputedStyle(element).textDecorationLine : null;
    };
    expect(struck("\u22121 POL")).toContain("line-through");
    expect(struck("+0.001 POL")).not.toContain("line-through");
  });

  it("marks the selected feed item", async () => {
    const app = await render(
      <ActionListItem
        action={actionFor("completed")}
        isSelected
        onActionSelect={vi.fn()}
      />
    );

    const selectedItem = app.container.querySelector<HTMLElement>(
      '[data-testid="activity-list-item-selected"]'
    );

    if (selectedItem === null) throw new Error("Expected the selected item");
    expect(selectedItem.getAttribute("aria-pressed")).toBe("true");
    expect(getComputedStyle(selectedItem).outlineStyle).toBe("solid");
  });
});
