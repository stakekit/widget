import BigNumber from "bignumber.js";
import { I18nextProvider } from "react-i18next";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { EarnYieldWithProvider } from "../../src/domain/schema/earn-models";

import type { useSelectValidator } from "../../src/features/earn/ui/classic/earn-page/components/select-validator-section/use-select-validator";
import { SelectYieldRewardDetails } from "../../src/features/earn/ui/classic/earn-page/components/select-yield-section/select-yield-reward-details";
import { ProviderSelectionCard } from "../../src/features/earn/ui/dashboard/earn-details/components/provider-selection-card";
import { createWidgetI18nInstance } from "../../src/services/translation/widget-translation";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";
import { render } from "../utils/test-utils";
import { decodeValidator } from "../utils/validators";
import { TestWidgetConfigProvider } from "../utils/widget-config-provider";

const i18nInstance = createWidgetI18nInstance();

const hookState = vi.hoisted(() => ({
  entryView: {} as Record<string, unknown>,
  selectValidator: undefined as unknown as ReturnType<
    typeof useSelectValidator
  >,
}));

vi.mock(
  "../../src/features/earn/ui/classic/earn-page/components/select-validator-section/use-select-validator",
  () => ({
    useSelectValidator: () => hookState.selectValidator,
  })
);

vi.mock(
  "../../src/features/earn/react/use-earn-facades",
  async (importOriginal) => {
    const actual = await importOriginal<object>();
    return {
      ...actual,
      useEarnEntry: () => ({ view: hookState.entryView }),
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
        fields: {
          validatorAddresses: {
            required: true,
          },
        },
      },
    },
  },
} satisfies EarnYieldWithProvider;

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
  selectedStake: multiSelectStake,
  selectedValidators: new Map(),
  validatorSearch: "",
  validatorsData: [],
  ...overrides,
});

const renderProviderSelectionCard = () =>
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

const renderSelectYieldRewardDetails = ({
  dashboardVariant = true,
}: {
  dashboardVariant?: boolean;
} = {}) =>
  render(
    <I18nextProvider i18n={i18nInstance}>
      <TestWidgetConfigProvider
        apiKey="test-key"
        baseUrl="https://api.example.com"
        dashboardVariant={dashboardVariant}
        variant="default"
        yieldsApiUrl="https://yield.example.com"
      >
        <SelectYieldRewardDetails />
      </TestWidgetConfigProvider>
    </I18nextProvider>
  );

describe("ProviderSelectionCard", () => {
  it("renders all selected validators with removal controls", async () => {
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        name: "Kiln",
        preferred: true,
        tvl: "1000000",
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        name: "P2P",
        tvl: "2000000",
      })
    );
    const onRemoveValidator = vi.fn();

    hookState.entryView = {
      providers: [],
    };
    hookState.selectValidator = createHookValue({
      onRemoveValidator,
      selectedValidators: new Map([
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
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
    const validator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        name: "Yuma",
        status: "not_found",
      })
    );

    hookState.entryView = {
      providers: [],
    };
    hookState.selectValidator = createHookValue({
      selectedValidators: new Map([[validator.key, validator]]),
    });

    const app = await renderProviderSelectionCard();

    await expect.element(app.getByText("Inactive")).toBeInTheDocument();
  });

  it("keeps the selector available from the multi-validator dashboard card", async () => {
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        name: "Kiln",
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        name: "P2P",
      })
    );

    hookState.entryView = {
      providers: [],
    };
    hookState.selectValidator = createHookValue({
      selectedValidators: new Map([
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
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
    const firstValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-1",
        name: "Kiln",
      })
    );
    const secondValidator = decodeValidator(
      yieldApiValidatorFixture({
        address: "validator-2",
        name: "P2P",
      })
    );

    hookState.entryView = {
      estimatedRewards: null,
      providers: [],
      rewardToken: null,
      rewardsTokenSymbol: "ETH",
      selectedStake: multiSelectStake,
      selectedValidators: new Map([
        [firstValidator.key, firstValidator],
        [secondValidator.key, secondValidator],
      ]),
      stakeAmount: new BigNumber(1),
    };

    const app = await renderSelectYieldRewardDetails();

    await expect
      .element(app.getByText("via Kiln and others"))
      .toBeInTheDocument();
  });

  it("hides the yield strategy summary in the widget variant", async () => {
    hookState.entryView = {
      estimatedRewards: null,
      providers: [],
      rewardToken: null,
      rewardsTokenSymbol: "ETH",
      selectedStake: multiSelectStake,
      selectedValidators: new Map(),
      stakeAmount: new BigNumber(1),
    };

    const app = await renderSelectYieldRewardDetails({
      dashboardVariant: false,
    });

    await expect
      .element(app.getByText("EarnYieldWithProvider strategy"))
      .not.toBeInTheDocument();
  });
});
