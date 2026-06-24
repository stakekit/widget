import { Maybe } from "purify-ts";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Yield } from "../../src/domain/types/yields";
import { SelectValidatorSection } from "../../src/pages/details/earn-page/components/select-validator-section";
import type { useSelectValidator } from "../../src/pages/details/earn-page/components/select-validator-section/use-select-validator";
import { SettingsContextProvider } from "../../src/providers/settings";
import { i18nInstance } from "../../src/translation";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
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
} as Yield;

const multiSelectStake = {
  ...selectedStake,
  mechanics: {
    ...selectedStake.mechanics,
    arguments: {
      ...selectedStake.mechanics.arguments,
      enter: {
        fields: [
          {
            label: "Validators",
            name: "validatorAddresses",
            required: true,
            type: "address",
          },
        ],
      },
    },
  },
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

  it("shows the View all action for multi-select validators when more pages exist", async () => {
    hookState.current = createHookValue({
      selectedStake: Maybe.of(multiSelectStake),
      validatorsData: Maybe.of(
        Array.from({ length: 4 }, (_, index) =>
          yieldApiValidatorFixture({
            address: `validator-${index}`,
            name: `Validator ${index}`,
            preferred: true,
          })
        )
      ),
      hasMoreValidators: true,
    });

    const app = await renderSection();

    await expect.element(app.getByText("Earn with")).toBeInTheDocument();

    const trigger = app.container.querySelector(
      '[data-rk="select-validator-plus"]'
    );
    expect(trigger).not.toBeNull();

    await userEvent.click(trigger as HTMLButtonElement);

    await expect.element(app.getByText("View all")).toBeInTheDocument();
  });
});
