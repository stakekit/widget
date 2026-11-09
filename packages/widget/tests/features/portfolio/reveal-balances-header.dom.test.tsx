import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RevealBalancesHeader } from "../../../src/features/portfolio/ui/components/reveal-balances-header";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils.dom";

type RevealState = {
  readonly canHide: boolean;
  readonly canReveal: boolean;
  readonly onHide: () => void;
  readonly onReveal: () => void;
  readonly revealFailed: boolean;
  readonly revealing: boolean;
};

const revealState = vi.hoisted(() => ({
  current: undefined as unknown as RevealState,
}));

vi.mock("../../../src/features/portfolio/ui/use-reveal-balances", () => ({
  useRevealBalances: () => revealState.current,
}));

const i18nInstance = createWidgetI18nInstance();

const createState = (overrides: Partial<RevealState> = {}): RevealState => ({
  canHide: false,
  canReveal: false,
  onHide: vi.fn(),
  onReveal: vi.fn(),
  revealFailed: false,
  revealing: false,
  ...overrides,
});

const renderHeader = (props: Parameters<typeof RevealBalancesHeader>[0]) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <div data-testid="host">
        <RevealBalancesHeader {...props} />
      </div>
    </I18nextProvider>
  );

const buttons = (container: HTMLElement) => [
  ...container.querySelectorAll("button"),
];

const buttonNamed = (container: HTMLElement, name: string) => {
  const button = buttons(container).find(
    (element) => element.textContent?.trim() === name
  );
  if (!button) throw new Error(`No "${name}" button`);
  return button;
};

/** The innermost element whose whole text is `text`. */
const elementWithText = (container: HTMLElement, text: string) => {
  const element = [...container.querySelectorAll("*")].find(
    (candidate) =>
      candidate.textContent === text &&
      [...candidate.children].every((child) => child.textContent !== text)
  );
  if (!element) throw new Error(`No "${text}"`);
  return element;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Reveal balances header", () => {
  it("puts the control on the title row beside the count", async () => {
    revealState.current = createState({ canReveal: true });
    const { container } = await renderHeader({
      leading: <p>My positions</p>,
      trailing: <p>3 active</p>,
    });

    const button = buttonNamed(container, "Reveal balances");
    const count = elementWithText(container, "3 active");
    const titleRow = elementWithText(container, "My positions").parentElement;

    expect(titleRow?.contains(button)).toBe(true);
    expect(count.parentElement?.contains(button)).toBe(true);

    await act(async () => button.click());
    expect(revealState.current.onReveal).toHaveBeenCalledOnce();
  });

  it("shows the reveal's failure under the row", async () => {
    revealState.current = createState({ canReveal: true, revealFailed: true });
    const { container } = await renderHeader({
      leading: <p>My positions</p>,
    });

    const failure = elementWithText(
      container,
      "Could not reveal the balances. Try again."
    );
    const titleRow = elementWithText(container, "My positions").parentElement;

    expect(titleRow?.contains(failure)).toBe(false);
    expect(titleRow?.parentElement?.contains(failure)).toBe(true);
  });

  it("offers Hide once balances are revealed", async () => {
    revealState.current = createState({ canHide: true });
    const { container } = await renderHeader({
      leading: <p>My positions</p>,
    });

    await act(async () => buttonNamed(container, "Hide balances").click());
    expect(revealState.current.onHide).toHaveBeenCalledOnce();
  });

  it("keeps the title row and shows no control without confidential positions", async () => {
    revealState.current = createState();
    const { container } = await renderHeader({
      leading: <p>My positions</p>,
    });

    expect(container.textContent).toContain("My positions");
    expect(buttons(container)).toHaveLength(0);
  });

  it("renders nothing alone without confidential positions", async () => {
    revealState.current = createState();
    const { container } = await renderHeader({});

    expect(
      container.querySelector('[data-testid="host"]')?.childElementCount
    ).toBe(0);
  });
});
