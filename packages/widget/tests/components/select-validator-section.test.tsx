import { Maybe } from "purify-ts";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Yield } from "../../src/domain/types/yields";
import { SelectValidatorSection } from "../../src/pages/details/earn-page/components/select-validator-section";
import type { useSelectValidator } from "../../src/pages/details/earn-page/components/select-validator-section/use-select-validator";
import { UtilaSelectValidatorSection } from "../../src/pages-dashboard/overview/earn-page/utila-select-validator-section";
import { SettingsContextProvider } from "../../src/providers/settings";
import { i18nInstance } from "../../src/translation";
import {
  legacyYieldFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { describe, expect, it } from "../utils/test-extend";
import { render } from "../utils/test-utils";

const hookState = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof useSelectValidator>,
}));

vi.mock(
  "../../src/pages/details/earn-page/components/select-validator-section/use-select-validator",
  () => ({
    useSelectValidator: () => hookState.current,
  })
);

const baseYield = yieldApiYieldFixture();
const selectedStake = {
  ...baseYield,
  mechanics: {
    ...baseYield.mechanics,
    requiresValidatorSelection: true,
    arguments: {
      enter: {
        fields: [
          {
            label: "Validator",
            name: "validatorAddress",
            required: true,
            type: "address",
          },
        ],
      },
      exit: { fields: [] },
    },
  },
  __fallback__: legacyYieldFixture(),
} as Yield;

const createHookValue = (
  overrides: Partial<ReturnType<typeof useSelectValidator>> = {}
): ReturnType<typeof useSelectValidator> => ({
  isLoading: false,
  onViewMoreClick: vi.fn(),
  onClose: vi.fn(),
  onOpen: vi.fn(),
  onItemClick: vi.fn(),
  onRemoveValidator: vi.fn(),
  selectedValidators: new Map(),
  selectedStake: Maybe.of(selectedStake),
  onValidatorSearch: vi.fn(),
  validatorsData: Maybe.of([yieldApiValidatorFixture()]),
  validatorSearch: "",
  hasMoreValidators: false,
  isLoadingMoreValidators: false,
  onLoadMoreValidators: vi.fn(),
  ...overrides,
});

const renderSection = () =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <SettingsContextProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <SelectValidatorSection />
      </SettingsContextProvider>
    </I18nextProvider>
  );

const renderUtilaSection = () =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <SettingsContextProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        variant="utila"
        yieldsApiUrl="https://yield.example.com"
      >
        <UtilaSelectValidatorSection />
      </SettingsContextProvider>
    </I18nextProvider>
  );

describe("SelectValidatorSection", () => {
  it("keeps validator selection available when search has no results", async () => {
    hookState.current = createHookValue({
      isLoading: false,
      validatorsData: Maybe.of([]),
      validatorSearch: "missing validator",
    });

    const app = await renderSection();

    await expect.element(app.getByText("Select validator")).toBeInTheDocument();

    const trigger = app.container.querySelector("button");
    expect(trigger).not.toBeNull();

    await userEvent.click(trigger as HTMLButtonElement);

    await expect
      .element(app.getByTestId("select-modal__search-input"))
      .toHaveValue("missing validator");
    await expect
      .element(app.getByText("No validators found"))
      .toBeInTheDocument();
  });

  it("keeps validator selection available while initial validators load", async () => {
    hookState.current = createHookValue({
      isLoading: true,
      validatorsData: Maybe.empty(),
      validatorSearch: "",
    });

    const app = await renderSection();

    await expect.element(app.getByText("Select validator")).toBeInTheDocument();

    const trigger = app.container.querySelector("button");
    expect(trigger).not.toBeNull();

    await userEvent.click(trigger as HTMLButtonElement);

    await expect
      .element(app.getByTestId("select-modal__search-input"))
      .toBeInTheDocument();
    await expect
      .element(app.getByText("No validators available"))
      .not.toBeInTheDocument();
  });

  it("shows an empty state in the dialog when no validators are available", async () => {
    hookState.current = createHookValue({
      isLoading: false,
      validatorsData: Maybe.of([]),
      validatorSearch: "",
    });

    const app = await renderSection();

    const trigger = app.container.querySelector("button");
    expect(trigger).not.toBeNull();

    await userEvent.click(trigger as HTMLButtonElement);

    await expect
      .element(app.getByText("No validators available"))
      .toBeInTheDocument();
  });

  it("keeps the dashboard Change action when search has no results", async () => {
    const selectedValidator = yieldApiValidatorFixture({
      address: "selected-validator",
      name: "Selected Validator",
    });

    hookState.current = createHookValue({
      isLoading: false,
      selectedValidators: new Map([
        [selectedValidator.address, selectedValidator],
      ]),
      validatorsData: Maybe.of([]),
      validatorSearch: "missing validator",
    });

    const app = await renderUtilaSection();

    await expect.element(app.getByText("Change")).toBeInTheDocument();

    await userEvent.click(app.getByText("Change"));

    await expect
      .element(app.getByTestId("select-modal__search-input"))
      .toHaveValue("missing validator");
    await expect
      .element(app.getByText("No validators found"))
      .toBeInTheDocument();
  });

  it("keeps the dashboard Change action while cleared search reloads validators", async () => {
    const selectedValidator = yieldApiValidatorFixture({
      address: "selected-validator",
      name: "Selected Validator",
    });

    hookState.current = createHookValue({
      isLoading: true,
      selectedValidators: new Map([
        [selectedValidator.address, selectedValidator],
      ]),
      validatorsData: Maybe.of([]),
      validatorSearch: "",
    });

    const app = await renderUtilaSection();

    await expect.element(app.getByText("Change")).toBeInTheDocument();
    await expect
      .element(app.getByText("Selected Validator"))
      .toBeInTheDocument();
  });
});
