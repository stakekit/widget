import { Option } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { widgetConfigAtom } from "../../src/app/config/settings";
import type { PositionsData } from "../../src/domain/types/positions";
import { tokenString } from "../../src/domain/types/tokens";
import {
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
} from "../../src/features/earn/state/atoms-state/catalog/atoms";
import {
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
} from "../../src/features/earn/state/atoms-state/catalog/keys";
import {
  earnMachineEntryAtom,
  earnMachineIntentAtom,
  earnMachineViewAtom,
} from "../../src/features/earn/state/atoms-state/machine/atoms";
import { makeResolvingWalletView } from "../../src/features/earn/state/atoms-state/resolver/view-model";
import type { EarnTokenOption } from "../../src/features/earn/state/atoms-state/types";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  earnPageSubmittedAtom,
} from "../../src/features/earn/state/page-workflow";
import { yieldApiYieldDtoFixture, yieldApiYieldFixture } from "../fixtures";

const baseDto = yieldApiYieldDtoFixture();
const firstYield = yieldApiYieldFixture();
const secondYield = yieldApiYieldFixture({
  id: "ethereum-usdc-lending",
  token: {
    ...baseDto.token,
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    name: "USD Coin",
    symbol: "USDC",
  },
});

const toTokenOption = (yieldModel: typeof firstYield): EarnTokenOption => ({
  amount: "10",
  availableYields: [yieldModel.id],
  source: "balance",
  token: yieldModel.token,
});

/**
 * Seeds every resource `resolveEarnView` reads so the published view reaches
 * `ready` without a network, which is the only status where the removed
 * write-back used to fire.
 */
const makeReadyRegistry = () => {
  const tokenOptions = [toTokenOption(firstYield), toTokenOption(secondYield)];

  return AtomRegistry.make({
    initialValues: [
      [
        initYieldAtom(new InitYieldKey({ yieldId: null })),
        AsyncResult.success(null),
      ],
      [
        mergedTokenOptionsAtom(
          new TokenOptionsKey({
            category: null,
            initToken: null,
            initTokenNetwork: null,
            initYieldId: null,
            scope: null,
            tokensForEnabledYieldsOnly: false,
          })
        ),
        AsyncResult.success(tokenOptions),
      ],
      [
        positionsDataAtom(new PositionsDataKey({ scope: null })),
        AsyncResult.success(new Map() as PositionsData),
      ],
      ...[firstYield, secondYield].map(
        (yieldModel) =>
          [
            earnYieldCatalogAtom(
              new YieldCatalogKey({
                category: null,
                network: yieldModel.token.network,
                yieldIds: [yieldModel.id],
              })
            ),
            AsyncResult.success([yieldModel]),
          ] as const
      ),
    ],
  });
};

describe("earn page workflow atoms", () => {
  it("derives input, selection, and quote models from the feature machine", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnPageSelectionAtom).yield).toBeNull();
    expect(registry.get(earnPageQuoteAtom).stakeAmount.toFixed()).toBe("0");
    registry.dispose();
  });

  it("preserves machine intent when runtime inputs change", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(earnMachineEntryAtom).tokensForEnabledYieldsOnly).toBe(
      false
    );
    registry.set(earnMachineIntentAtom, {
      type: "category/select",
      category: "defi",
    });
    registry.set(widgetConfigAtom, {
      ...registry.get(widgetConfigAtom),
      tokensForEnabledYieldsOnly: true,
    });

    expect(registry.get(earnMachineEntryAtom).tokensForEnabledYieldsOnly).toBe(
      true
    );
    expect(registry.get(earnMachineIntentAtom).selectedCategory).toBe("defi");
    registry.dispose();
  });

  it("publishes resolving-wallet while retaining the selection snapshot", () => {
    const registry = makeReadyRegistry();
    const previousView = registry.get(earnMachineViewAtom);

    expect(previousView.status).toBe("ready");
    expect(
      makeResolvingWalletView({
        intent: registry.get(earnMachineIntentAtom),
        previous: Option.some(previousView),
      })
    ).toMatchObject({
      can: {
        selectToken: false,
        selectValidator: false,
        selectYield: false,
        submit: false,
      },
      selection: previousView.selection,
      status: "resolving-wallet",
    });
    registry.dispose();
  });

  it("keeps publishing view updates after a command when the first read has no listener", () => {
    const registry = makeReadyRegistry();

    // useSyncExternalStore reads a snapshot during render and only subscribes on
    // commit, so the machine view is first built with no listener attached.
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnMachineViewAtom).status).toBe("ready");
    registry.subscribe(earnPageInputAtom, () => {}, { immediate: false });

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "5",
    });
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("5");

    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "7",
    });
    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("7");
    registry.dispose();
  });

  it("derives the published view without writing back into machine state", () => {
    const registry = makeReadyRegistry();
    const intentBefore = registry.get(earnMachineIntentAtom);

    // The resolver fills the selection from defaults the intent never named.
    expect(registry.get(earnMachineViewAtom).selection.yield).toEqual(
      firstYield
    );
    expect(intentBefore.selectedYieldId).toBeNull();
    expect(registry.get(earnMachineIntentAtom)).toBe(intentBefore);
    registry.dispose();
  });

  it("owns searches and submission state", () => {
    const registry = AtomRegistry.make();

    registry.set(earnPageSearchAtom, {
      stake: "ethereum",
      token: "eth",
      validator: "validator",
    });
    registry.set(earnPageSubmittedAtom, true);

    expect(registry.get(earnPageSearchAtom).token).toBe("eth");
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);
    registry.dispose();
  });

  it("resets submission state when the resolved selection changes", () => {
    const registry = makeReadyRegistry();

    expect(registry.get(earnMachineViewAtom).selection.token?.token).toEqual(
      firstYield.token
    );

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "token/select",
      tokenKey: tokenString(secondYield.token),
    });
    expect(registry.get(earnMachineViewAtom).selection.yield).toEqual(
      secondYield
    );
    expect(registry.get(earnPageSubmittedAtom)).toBe(false);

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "1",
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);
    registry.dispose();
  });
});
