import { expect, it, vi } from "vitest";
import "../../src/shared/styles/theme/global.css";
import { ActionListItem } from "../../src/features/activity/ui/activity-page/components/action-list-item";
import { widgetContainerName } from "../../src/shared/styles/tokens/containers.css";
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
      badgeLabel: "Failed",
      canOpenDetails: false,
      iconType: "in",
      isPositive: true,
      providersDetails: undefined,
      showFailedBadge: false,
      showUnavailableYieldDetails: true,
      timestampAbsolute: "Today · 13:43",
      timestampRelative: "21m ago",
      title: "Deposited Unknown token",
      tokenSymbol: "Unknown token",
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
  const amount = findExactText(app.container, "+0.001 Unknown token");
  const unavailableDetails = findExactText(
    app.container,
    "Yield details unavailable"
  );

  expect(amount).toBeDefined();
  expect(unavailableDetails).toBeUndefined();
  expect(getComputedStyle(amount!).display).toBe("none");
});

it("keeps activity amounts visible outside the widget variant", async () => {
  const app = await render(
    <div data-rk="stakekit" style={{ width: 368 }}>
      <ActionListItem action={{} as never} onActionSelect={vi.fn()} />
    </div>
  );
  const amount = findExactText(app.container, "+0.001 Unknown token");
  const unavailableDetails = findExactText(
    app.container,
    "Yield details unavailable"
  );

  expect(amount).toBeDefined();
  expect(unavailableDetails).toBeUndefined();
  expect(getComputedStyle(amount!).display).not.toBe("none");
});
