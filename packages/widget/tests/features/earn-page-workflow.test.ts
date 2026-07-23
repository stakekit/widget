import { Option, Schema } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import { widgetConfigAtom } from "../../src/app/config/settings";
import { YieldId } from "../../src/domain/schema/identifiers";
import {
  earnMachineEntryAtom,
  earnMachineIntentAtom,
  earnMachineViewAtom,
  resolveWalletMachineView,
} from "../../src/features/earn/state/atoms-state/machine/atoms";
import {
  earnPageInputAtom,
  earnPageQuoteAtom,
  earnPageSearchAtom,
  earnPageSelectionAtom,
  earnPageSubmittedAtom,
  getEarnPageValidation,
} from "../../src/features/earn/state/page-workflow";

describe("earn page workflow atoms", () => {
  it("derives input, selection, and quote models from the feature machine", () => {
    const registry = AtomRegistry.make();

    expect(registry.get(earnPageInputAtom).stakeAmount).toBe("0");
    expect(registry.get(earnPageSelectionAtom).yield).toBeNull();
    expect(registry.get(earnPageQuoteAtom).stakeAmount.toFixed()).toBe("0");
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
  });

  it("publishes resolving-wallet while retaining the selection snapshot", () => {
    const registry = AtomRegistry.make();
    const previousView = registry.get(earnMachineViewAtom);
    const nextView = resolveWalletMachineView({
      entry: {
        ...registry.get(earnMachineEntryAtom),
        walletResolution: "pending",
      },
      previous: Option.some(previousView),
      resolved: previousView,
    });

    expect(nextView).toMatchObject({
      can: {
        selectToken: false,
        selectYield: false,
        selectValidator: false,
        submit: false,
      },
      selection: previousView.selection,
      status: "resolving-wallet",
    });
    registry.dispose();
  });

  it("isolates machine intent between widget registries", () => {
    const firstRegistry = AtomRegistry.make();
    const secondRegistry = AtomRegistry.make();

    firstRegistry.set(earnMachineIntentAtom, {
      type: "category/select",
      category: "rwa",
    });

    expect(firstRegistry.get(earnMachineIntentAtom).selectedCategory).toBe(
      "rwa"
    );
    expect(
      secondRegistry.get(earnMachineIntentAtom).selectedCategory
    ).toBeNull();
  });

  it("owns searches, submission state, and validation derivation", () => {
    const registry = AtomRegistry.make();

    registry.set(earnPageSearchAtom, {
      stake: "ethereum",
      token: "eth",
      validator: "validator",
    });
    registry.set(earnPageSubmittedAtom, true);

    expect(registry.get(earnPageSearchAtom).token).toBe("eth");
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);

    const validation = getEarnPageValidation({
      connected: true,
      hasTronResource: false,
      stakeAmountGreaterThanAvailableAmount: false,
      stakeAmountGreaterThanMax: false,
      stakeAmountIsZero: true,
      stakeAmountLessThanMin: false,
      submitted: true,
      tronResourceRequired: true,
    });

    expect(validation).toEqual({
      errors: {
        stakeAmountGreaterThanAvailableAmount: false,
        stakeAmountGreaterThanMax: false,
        stakeAmountIsZero: true,
        stakeAmountLessThanMin: false,
        tronResource: true,
      },
      hasErrors: true,
      submitted: true,
    });
  });

  it("resets submission state when category, yield, or token changes", () => {
    const registry = AtomRegistry.make();

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "category/select",
      category: "defi",
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(false);

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "yield/select",
      yieldId: Schema.decodeSync(YieldId)("yield-1"),
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(false);

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "token/select",
      tokenKey: "ethereum-0xtoken",
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(false);

    registry.set(earnPageSubmittedAtom, true);
    registry.set(earnMachineIntentAtom, {
      type: "stakeAmount/change",
      amount: "1",
    });
    expect(registry.get(earnPageSubmittedAtom)).toBe(true);
  });
});
