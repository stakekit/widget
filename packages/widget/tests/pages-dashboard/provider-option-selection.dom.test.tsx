import { act } from "react";
import { I18nextProvider } from "react-i18next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../src/domain/earn/models";
import { ProviderOption } from "../../src/domain/identity/identifiers";
import type { EarnProviderOption } from "../../src/features/earn/state/earn-selection/types";
import { ProviderSelectionCard } from "../../src/features/earn/ui/dashboard/earn-details/components/provider-selection-card";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils.dom.tsx";
import { decodeValidator } from "../utils/validators";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  providerItems: [] as ReadonlyArray<EarnProviderOption>,
  selectProvider: vi.fn(),
  selectedStake: null as EarnYieldWithProvider | null,
  selectedValidators: new Map<string, EarnValidator>(),
}));

vi.mock("../../src/features/earn/react/use-select-validator", () => ({
  useSelectValidator: () => ({
    hasMoreValidators: false,
    isLoading: false,
    isLoadingMoreValidators: false,
    onClose: vi.fn(),
    onItemClick: vi.fn(),
    onLoadMoreValidators: vi.fn(),
    onOpen: vi.fn(),
    onRemoveValidator: vi.fn(),
    onValidatorSearch: vi.fn(),
    onViewMoreClick: vi.fn(),
    selectedStake: hookState.selectedStake,
    selectedValidators: hookState.selectedValidators,
    validatorSearch: "",
    validatorsData: [],
  }),
}));

vi.mock(
  "../../src/features/earn/react/use-earn-facades",
  async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
      ...actual,
      useEarnEntry: () => ({ view: { providers: [] } }),
      useEarnProviderOptions: () => ({
        select: hookState.selectProvider,
        view: {
          appLoading: false,
          canSelect: hookState.providerItems.length > 1,
          items: hookState.providerItems,
          selected: hookState.providerItems[0]?.value ?? null,
        },
      }),
    };
  }
);

const p2p = ProviderOption.make("P2P");
const other = ProviderOption.make("OTHER");

const baseYield = yieldApiYieldFixture();
const providerOptionsStake = {
  ...baseYield,
  mechanics: {
    ...baseYield.mechanics,
    requiresValidatorSelection: false,
  },
} satisfies EarnYieldWithProvider;
const validatorStake = {
  ...baseYield,
  mechanics: {
    ...baseYield.mechanics,
    requiresValidatorSelection: true,
  },
} satisfies EarnYieldWithProvider;

const renderCard = () =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        dashboardVariant
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <ProviderSelectionCard />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );

const findButtonByText = (text: string) =>
  [...document.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text)
  );

beforeEach(() => {
  hookState.providerItems = [];
  hookState.selectProvider = vi.fn();
  hookState.selectedStake = providerOptionsStake;
  hookState.selectedValidators = new Map();
});

describe("dashboard ProviderSelectionCard provider options", () => {
  it("lets the user choose among advertised provider options", async () => {
    hookState.providerItems = [
      { provider: null, value: p2p },
      { provider: null, value: other },
    ];

    const app = await renderCard();

    expect(app.container.textContent).toContain("P2P");

    const changeButton = findButtonByText("Change");
    expect(changeButton).toBeDefined();
    await act(async () => changeButton?.click());

    const otherOption = document.querySelector<HTMLElement>(
      '[data-testid="select-provider-option-OTHER"]'
    );
    expect(otherOption).not.toBeNull();
    await act(async () => otherOption?.click());

    expect(hookState.selectProvider).toHaveBeenCalledWith(other);
  });

  it("renders a single provider option without a change control", async () => {
    hookState.providerItems = [{ provider: null, value: p2p }];

    const app = await renderCard();

    expect(app.container.textContent).toContain("P2P");
    expect(findButtonByText("Change")).toBeUndefined();
  });

  it("renders nothing when the yield advertises no provider options", async () => {
    const app = await renderCard();

    expect(app.container.textContent).toBe("");
  });

  it("keeps validator selection for validator-required yields", async () => {
    const validator = decodeValidator(
      yieldApiValidatorFixture({ address: "validator-1", name: "Kiln" })
    );
    hookState.selectedStake = validatorStake;
    hookState.selectedValidators = new Map([[validator.key, validator]]);

    const app = await renderCard();

    expect(app.container.textContent).toContain("Kiln");
    expect(findButtonByText("Change")).toBeDefined();
    expect(
      document.querySelector('[data-testid^="select-provider-option-"]')
    ).toBeNull();
  });
});
