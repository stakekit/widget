import BigNumber from "bignumber.js";
import { Maybe } from "purify-ts";
import { I18nextProvider } from "react-i18next";
import { vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { Yield } from "../../src/domain/types/yields";
import type { useSelectValidator } from "../../src/pages/details/earn-page/components/select-validator-section/use-select-validator";
import { SelectYieldRewardDetails } from "../../src/pages/details/earn-page/components/select-yield-section/select-yield-reward-details";
import { ProviderSelectionCard } from "../../src/pages-dashboard/overview/earn-details/components/provider-selection-card";
import { SettingsContextProvider } from "../../src/providers/settings";
import { i18nInstance } from "../../src/translation";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { describe, expect, it } from "../utils/test-extend";
import { render } from "../utils/test-utils";

const hookState = vi.hoisted(() => ({
  earnContext: {} as Record<string, unknown>,
  selectValidator: undefined as unknown as ReturnType<
    typeof useSelectValidator
  >,
}));

vi.mock(
  "../../src/pages/details/earn-page/components/select-validator-section/use-select-validator",
  () => ({
    useSelectValidator: () => hookState.selectValidator,
  })
);

vi.mock(
  "../../src/pages/details/earn-page/state/earn-page-context",
  async (importOriginal) => {
    const actual = await importOriginal<object>();

    return {
      ...actual,
      useEarnPageContext: () => hookState.earnContext,
    };
  }
);

const baseYield = yieldApiYieldFixture();
const multiSelectStake = {
  ...baseYield,
  mechanics: {
    ...baseYield.mechanics,
    requiresValidatorSelection: true,
    arguments: {
      ...baseYield.mechanics.arguments,
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
  selectedStake: Maybe.of(multiSelectStake),
  selectedValidators: new Map(),
  validatorSearch: "",
  validatorsData: Maybe.of([]),
  ...overrides,
});

const renderProviderSelectionCard = () =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <SettingsContextProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        dashboardVariant
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <ProviderSelectionCard />
      </SettingsContextProvider>
    </I18nextProvider>
  );

const renderSelectYieldRewardDetails = ({
  dashboardVariant = true,
}: {
  dashboardVariant?: boolean;
} = {}) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <SettingsContextProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        dashboardVariant={dashboardVariant}
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <SelectYieldRewardDetails />
      </SettingsContextProvider>
    </I18nextProvider>
  );

describe("ProviderSelectionCard", () => {
  it("renders all selected validators with removal controls", async () => {
    const firstValidator = yieldApiValidatorFixture({
      address: "validator-1",
      name: "Kiln",
      preferred: true,
      tvl: "1000000",
    });
    const secondValidator = yieldApiValidatorFixture({
      address: "validator-2",
      name: "P2P",
      tvl: "2000000",
    });
    const onRemoveValidator = vi.fn();

    hookState.earnContext = {
      providersDetails: Maybe.of([]),
    };
    hookState.selectValidator = createHookValue({
      onRemoveValidator,
      selectedValidators: new Map([
        [firstValidator.address, firstValidator],
        [secondValidator.address, secondValidator],
      ]),
    });

    const app = await renderProviderSelectionCard();

    await expect.element(app.getByText("Kiln")).toBeInTheDocument();
    await expect.element(app.getByText("P2P")).toBeInTheDocument();
    await expect.element(app.getByText("Preferred")).toBeInTheDocument();

    const removeP2P = app.container.querySelector('[aria-label="Remove P2P"]');
    expect(removeP2P).not.toBeNull();

    await userEvent.click(removeP2P as HTMLButtonElement);

    expect(onRemoveValidator).toHaveBeenCalledWith(secondValidator);
  });

  it("maps unknown validator statuses to inactive", async () => {
    const validator = yieldApiValidatorFixture({
      address: "validator-1",
      name: "Yuma",
      status: "not_found",
    });

    hookState.earnContext = {
      providersDetails: Maybe.of([]),
    };
    hookState.selectValidator = createHookValue({
      selectedValidators: new Map([[validator.address, validator]]),
    });

    const app = await renderProviderSelectionCard();

    await expect.element(app.getByText("Inactive")).toBeInTheDocument();
  });

  it("keeps the selector available from the multi-validator dashboard card", async () => {
    const firstValidator = yieldApiValidatorFixture({
      address: "validator-1",
      name: "Kiln",
    });
    const secondValidator = yieldApiValidatorFixture({
      address: "validator-2",
      name: "P2P",
    });

    hookState.earnContext = {
      providersDetails: Maybe.of([]),
    };
    hookState.selectValidator = createHookValue({
      selectedValidators: new Map([
        [firstValidator.address, firstValidator],
        [secondValidator.address, secondValidator],
      ]),
      validatorSearch: "missing validator",
    });

    const app = await renderProviderSelectionCard();

    await userEvent.click(app.getByText("Manage validators"));

    await expect
      .element(app.getByTestId("select-modal__search-input"))
      .toHaveValue("missing validator");
    await expect
      .element(app.getByText("No validators found"))
      .toBeInTheDocument();
  });
});

describe("SelectYieldRewardDetails", () => {
  it("uses all selected validators in the dashboard Stake via summary", async () => {
    const firstValidator = yieldApiValidatorFixture({
      address: "validator-1",
      name: "Kiln",
    });
    const secondValidator = yieldApiValidatorFixture({
      address: "validator-2",
      name: "P2P",
    });

    hookState.earnContext = {
      estimatedRewards: Maybe.empty(),
      providersDetails: Maybe.of([]),
      rewardToken: Maybe.empty(),
      rewardsTokenSymbol: "ETH",
      selectedStake: Maybe.of(multiSelectStake),
      selectedValidators: new Map([
        [firstValidator.address, firstValidator],
        [secondValidator.address, secondValidator],
      ]),
      stakeAmount: new BigNumber(1),
    };

    const app = await renderSelectYieldRewardDetails();

    await expect
      .element(app.getByText("via Kiln and others"))
      .toBeInTheDocument();
  });

  it("hides the yield strategy summary in the widget variant", async () => {
    hookState.earnContext = {
      estimatedRewards: Maybe.empty(),
      providersDetails: Maybe.of([]),
      rewardToken: Maybe.empty(),
      rewardsTokenSymbol: "ETH",
      selectedStake: Maybe.of(multiSelectStake),
      selectedValidators: new Map(),
      stakeAmount: new BigNumber(1),
    };

    const app = await renderSelectYieldRewardDetails({
      dashboardVariant: false,
    });

    await expect
      .element(app.getByText("Yield strategy"))
      .not.toBeInTheDocument();
  });
});
