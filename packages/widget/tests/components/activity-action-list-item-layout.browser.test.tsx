import { expect, it, vi } from "vitest";
import "../../src/shared/styles/theme/global.css";
import { ActionListItem } from "../../src/features/activity/ui/activity-page/components/action-list-item";
import {
  activityFeedContainerName,
  widgetContainerName,
} from "../../src/shared/styles/tokens/containers.css";
import { render } from "../utils/test-utils";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<object>();

  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key }),
  };
});

vi.mock(
  "../../src/features/activity/ui/activity-page/hooks/use-action-list-item",
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
      tokenSymbol: "POL",
    }),
  })
);

const findExactText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll<HTMLParagraphElement>("p")).find(
    (element) => element.textContent === text
  );

it("hides activity amounts in the widget variant", async () => {
  const app = await render(
    <div
      data-rk="stakekit"
      style={{
        containerName: widgetContainerName,
        containerType: "inline-size",
        width: 368,
      }}
    >
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </div>
  );
  const amount = findExactText(app.container, "+0.001 POL");
  const unavailableDetails = findExactText(
    app.container,
    "Yield details unavailable"
  );

  expect(amount).toBeDefined();
  expect(findExactText(app.container, "Completed")).toBeDefined();
  expect(unavailableDetails).toBeUndefined();
  expect(getComputedStyle(amount!).display).toBe("none");
});

it("hides activity amounts in a narrow activity feed", async () => {
  const app = await render(
    <div
      data-rk="activity-feed"
      style={{
        containerName: activityFeedContainerName,
        containerType: "inline-size",
        width: 320,
      }}
    >
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </div>
  );
  const amount = findExactText(app.container, "+0.001 POL");

  expect(amount).toBeDefined();
  expect(findExactText(app.container, "Completed")).toBeDefined();
  expect(getComputedStyle(amount!).display).toBe("none");
});

it("keeps activity amounts visible outside narrow containers", async () => {
  const app = await render(
    <div data-rk="stakekit" style={{ width: 560 }}>
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </div>
  );
  const amount = findExactText(app.container, "+0.001 POL");
  const unavailableDetails = findExactText(
    app.container,
    "Yield details unavailable"
  );

  expect(amount).toBeDefined();
  expect(unavailableDetails).toBeUndefined();
  expect(getComputedStyle(amount!).display).not.toBe("none");
});

it("marks the selected feed item", async () => {
  const app = await render(
    <ActionListItem action={{} as never} isSelected onActionSelect={vi.fn()} />
  );

  expect(
    app.container.querySelector('[data-rk="activity-list-item-selected"]')
  ).not.toBeNull();
});
