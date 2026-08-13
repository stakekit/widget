import { Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import type { EarnYield } from "../../src/domain/earn/models";
import { getEnterAmountConstraint } from "../../src/domain/earn/stake";
import { WalletAddress, YieldId } from "../../src/domain/identity/identifiers";
import type { PositionsData } from "../../src/domain/portfolio/positions";
import { earnSelectionViewAtom } from "../../src/features/earn/state/earn-selection";
import {
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
} from "../../src/features/earn/state/earn-selection/catalog/catalog";
import {
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/earn-selection/catalog/keys";
import {
  canSubmitEarnForm,
  resolveForm,
} from "../../src/features/earn/state/earn-selection/model/form";
import { earnMachineEntryAtom } from "../../src/features/earn/state/earn-selection/state/atoms";
import {
  type EarnEntry,
  type EarnMachineIntent,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/earn-selection/types";
import { WalletScopeKey } from "../../src/services/wallet/wallet-scope";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const positionsData: PositionsData = new Map();
const address = Schema.decodeSync(WalletAddress)("0xwallet");

const withAmountRange = (minimum: number, maximum: number): EarnYield => {
  const yieldDto = yieldApiYieldDtoFixture();

  return yieldApiYieldFixture({
    mechanics: {
      ...yieldDto.mechanics,
      arguments: {
        ...yieldDto.mechanics.arguments,
        enter: {
          fields: [
            {
              label: "Amount",
              maximum: maximum.toString(),
              minimum: minimum.toString(),
              name: "amount",
              required: true,
              type: "string",
            },
          ],
        },
      },
    },
  });
};

const resolve = ({
  availableAmount,
  intent = makeDefaultEarnIntent(),
  selectedYield,
}: {
  availableAmount: string | null;
  intent?: EarnMachineIntent;
  selectedYield: EarnYield;
}) =>
  resolveForm({
    availableAmount,
    intent,
    positionsData,
    selectedYield,
  });

describe("Earn force-max amount resolution", () => {
  const forceMaxYield = withAmountRange(-1, -1);

  it("recognizes the sentinel before numeric range calculation", () => {
    expect(getEnterAmountConstraint(forceMaxYield, positionsData)).toEqual({
      type: "force-max",
    });
  });

  it("uses the available balance and never exposes the sentinel", () => {
    const form = resolve({
      availableAmount: "10",
      selectedYield: forceMaxYield,
    });

    expect(form.stakeAmount).toBe("10");
    expect(form.stakeAmount).not.toBe("-1");
    expect(form.useMaxAmount).toBe(true);
  });

  it("resolves view.form from the balance and disables submit until it is available", () => {
    const scope = new WalletScopeKey({
      additionalAddresses: null,
      address,
      network: "ethereum",
    });
    const entry: EarnEntry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams: null,
      walletScope: scope,
      walletResolution: "settled",
    };
    const makeView = (source: "balance" | "default") => {
      const tokenOptionsKey = new TokenOptionsKey({
        category: null,
        initToken: null,
        initTokenNetwork: null,
        initYieldId: null,
        scope,
        tokensForEnabledYieldsOnly: false,
      });
      const positionsKey = new PositionsDataKey({
        scope,
      });
      const yieldCatalogKey = new YieldCatalogKey({
        category: null,
        network: forceMaxYield.token.network,
        yieldIds: [forceMaxYield.id],
      });
      const registry = AtomRegistry.make({
        initialValues: [
          Atom.initialValue(earnMachineEntryAtom, entry),
          [
            initYieldAtom(new InitYieldKey({ yieldId: null })),
            AsyncResult.success(null),
          ],
          [
            mergedTokenOptionsAtom(tokenOptionsKey),
            AsyncResult.success([
              {
                amount: source === "balance" ? "10" : "0",
                availableYields: [forceMaxYield.id],
                source,
                token: forceMaxYield.token,
              },
            ]),
          ],
          [positionsDataAtom(positionsKey), AsyncResult.success(positionsData)],
          [
            earnYieldCatalogAtom(yieldCatalogKey),
            AsyncResult.success([forceMaxYield]),
          ],
        ],
      });
      try {
        return registry.get(earnSelectionViewAtom);
      } finally {
        registry.dispose();
      }
    };

    const withBalance = makeView("balance");
    const withoutBalance = makeView("default");

    expect(withBalance.form.stakeAmount).toBe("10");
    expect(withBalance.canSubmit).toBe(true);
    expect(withoutBalance.form.stakeAmount).toBe("0");
    expect(withoutBalance.canSubmit).toBe(false);
  });

  it("overrides stale amount intent and follows balance revalidation", () => {
    const intent = {
      ...makeDefaultEarnIntent(),
      stakeAmount: "4",
    };

    expect(
      resolve({ availableAmount: "10", intent, selectedYield: forceMaxYield })
        .stakeAmount
    ).toBe("10");
    expect(
      resolve({ availableAmount: "12", intent, selectedYield: forceMaxYield })
        .stakeAmount
    ).toBe("12");
  });

  it("uses a safe zero while the force-max balance is unresolved", () => {
    expect(
      resolve({ availableAmount: null, selectedYield: forceMaxYield })
        .stakeAmount
    ).toBe("0");
  });

  it("preserves ordinary range defaults and explicit intent", () => {
    const rangeYield = withAmountRange(2, 20);

    expect(
      resolve({ availableAmount: "10", selectedYield: rangeYield }).stakeAmount
    ).toBe("2");
    expect(
      resolve({
        availableAmount: "10",
        intent: {
          ...makeDefaultEarnIntent(),
          amountInput: "manual",
          stakeAmount: "7",
        },
        selectedYield: rangeYield,
      }).stakeAmount
    ).toBe("7");
  });

  it("preserves an explicit zero so validation can reject it", () => {
    const rangeYield = withAmountRange(2, 20);

    expect(
      resolve({
        availableAmount: "10",
        intent: {
          ...makeDefaultEarnIntent(),
          amountInput: "manual",
          stakeAmount: "0",
        },
        selectedYield: rangeYield,
      }).stakeAmount
    ).toBe("0");
  });

  it("rejects zero, below-minimum, above-maximum, and above-balance amounts", () => {
    const rangeYield = withAmountRange(2, 20);
    const canSubmit = (stakeAmount: string) =>
      canSubmitEarnForm({
        availableAmount: "10",
        form: {
          providerYieldId: null,
          stakeAmount,
          tronResource: null,
          useMaxAmount: false,
        },
        positionsData,
        selectedYield: rangeYield,
      });

    expect(canSubmit("0")).toBe(false);
    expect(canSubmit("1")).toBe(false);
    expect(canSubmit("21")).toBe(false);
    expect(canSubmit("11")).toBe(false);
    expect(canSubmit("7")).toBe(true);
  });

  it("uses only advertised provider and Tron options", () => {
    const base = yieldApiYieldDtoFixture();
    const selectedYield = yieldApiYieldFixture({
      mechanics: {
        ...base.mechanics,
        arguments: {
          ...base.mechanics.arguments,
          enter: {
            fields: [
              {
                label: "Provider",
                name: "providerId",
                options: ["ethereum-provider-a"],
                required: true,
                type: "string",
              },
              {
                label: "Resource",
                name: "tronResource",
                options: ["BANDWIDTH"],
                required: true,
                type: "enum",
              },
            ],
          },
        },
      },
    });
    const form = resolve({
      availableAmount: "10",
      intent: {
        ...makeDefaultEarnIntent(),
        selectedProviderYieldId: Schema.decodeSync(YieldId)(
          "ethereum-provider-b"
        ),
        tronResource: "ENERGY",
      },
      selectedYield,
    });

    expect(form.providerYieldId).toBe("ethereum-provider-a");
    expect(form.tronResource).toBe("BANDWIDTH");
  });
});
