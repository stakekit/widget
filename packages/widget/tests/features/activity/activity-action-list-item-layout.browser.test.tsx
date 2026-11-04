import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import "../../../src/ui/theme/reset.css";
import { ActionListItem } from "../../../src/features/activity/ui/activity-page/components/action-list-item";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock(
  "../../../src/features/activity/ui/activity-page/hooks/use-action-list-item",
  () => ({
    useActionListItem: () => ({
      amount: "0.001",
      amountSign: "+",
      badgeLabel: "Completed",
      canOpenDetails: false,
      iconType: "in",
      isPositive: true,
      providersDetails: undefined,
      statusLabel: "completed",
      timestampAbsolute: "Today · 13:43",
      timestampRelative: "21m ago",
      title: "Deposited POL",
      amountTokenSymbol: "POL",
    }),
  })
);

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

it("hides activity amounts below the sm container size", async () => {
  const app = await render(
    <SizeContainer width={368}>
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </SizeContainer>
  );
  const amount = findExactText(app.container, "+0.001 POL");

  expect(amount).toBeDefined();
  expect(findExactText(app.container, "Completed")).toBeDefined();
  expect(
    findExactText(app.container, "Yield details unavailable")
  ).toBeUndefined();
  expect(amount?.checkVisibility()).toBe(false);
});

it("follows the nearest container, not the window", async () => {
  const app = await render(
    <SizeContainer width={800}>
      <SizeContainer width={320}>
        <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
      </SizeContainer>
    </SizeContainer>
  );
  const amount = findExactText(app.container, "+0.001 POL");

  expect(amount).toBeDefined();
  expect(amount?.checkVisibility()).toBe(false);
});

it("keeps activity amounts visible from the sm container size up", async () => {
  const app = await render(
    <SizeContainer width={560}>
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </SizeContainer>
  );
  const amount = findExactText(app.container, "+0.001 POL");

  expect(amount).toBeDefined();
  expect(amount?.checkVisibility()).toBe(true);
});

it("marks the selected feed item", async () => {
  const app = await render(
    <ActionListItem action={{} as never} isSelected onActionSelect={vi.fn()} />
  );

  const selectedItem = app.container.querySelector<HTMLElement>(
    '[data-testid="activity-list-item-selected"]'
  );

  if (selectedItem === null) throw new Error("Expected the selected item");
  expect(selectedItem.getAttribute("aria-pressed")).toBe("true");
  expect(getComputedStyle(selectedItem).outlineStyle).toBe("solid");
});
