import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevealBalancesHeader } from "../../../src/features/portfolio/ui/components/reveal-balances-header";
import { createWidgetI18nInstance } from "../../../src/services/translation/widget-translation";
import { render } from "../../utils/test-utils";

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

vi.mock("../../../src/features/portfolio/react/use-reveal-balances", () => ({
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Reveal balances header", () => {
  it("puts the control on the title row beside the count", async () => {
    revealState.current = createState({ canReveal: true });
    const app = await renderHeader({
      leading: <p>My positions</p>,
      trailing: <p>3 active</p>,
    });

    await expect
      .element(app.getByRole("button", { name: "Reveal balances" }))
      .toBeInTheDocument();
    const button = app.getByRole("button", { name: "Reveal balances" });
    const count = app.getByText("3 active").element();
    const titleRow = app.getByText("My positions").element().parentElement;

    expect(titleRow?.contains(button.element())).toBe(true);
    expect(count.parentElement?.contains(button.element())).toBe(true);

    await button.click();
    expect(revealState.current.onReveal).toHaveBeenCalledOnce();
  });

  it("shows the reveal's failure under the row", async () => {
    revealState.current = createState({ canReveal: true, revealFailed: true });
    const app = await renderHeader({ leading: <p>My positions</p> });

    const failure = app
      .getByText("Could not reveal the balances. Try again.")
      .element();
    const titleRow = app.getByText("My positions").element().parentElement;

    expect(titleRow?.contains(failure)).toBe(false);
    expect(titleRow?.parentElement?.contains(failure)).toBe(true);
  });

  it("offers Hide once balances are revealed", async () => {
    revealState.current = createState({ canHide: true });
    const app = await renderHeader({ leading: <p>My positions</p> });

    await app.getByRole("button", { name: "Hide balances" }).click();
    expect(revealState.current.onHide).toHaveBeenCalledOnce();
  });

  it("keeps the title row and shows no control without confidential positions", async () => {
    revealState.current = createState();
    const app = await renderHeader({ leading: <p>My positions</p> });

    await expect.element(app.getByText("My positions")).toBeInTheDocument();
    expect(app.getByRole("button").elements()).toHaveLength(0);
  });

  it("renders nothing alone without confidential positions", async () => {
    revealState.current = createState();
    const app = await renderHeader({});

    expect(app.getByTestId("host").element().childElementCount).toBe(0);
  });
});
