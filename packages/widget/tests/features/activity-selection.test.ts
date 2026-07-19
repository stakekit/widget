import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";
import {
  activitySelectionAtom,
  activityTransactionWorkflowKeyAtom,
} from "../../src/features/activity/state/selection";
import { currentWalletScopeAtom } from "../../src/features/wallet/state/selectors";
import { WalletScopeKey } from "../../src/services/wallet/domain/scope";
import {
  yieldApiActionFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
} from "../fixtures";
import { decodeValidator } from "../utils/validators";

describe("activity selection atoms", () => {
  it("initializes empty, exposes focused selections, and resets", () => {
    const action = yieldApiActionFixture();
    const selectedYield = yieldApiYieldFixture();
    const walletScope = new WalletScopeKey({
      address: action.address!,
      network: "ethereum",
    });
    const validators = [decodeValidator(yieldApiValidatorFixture())];
    const providersDetails = [
      {
        address: "validator-1",
        logo: "https://example.com/provider.png",
        name: "Provider",
        rewardRate: 4.2,
        rewardType: "apy",
        website: "https://example.com",
      },
    ];
    const registry = AtomRegistry.make({
      initialValues: [[currentWalletScopeAtom, walletScope]],
    });

    expect(registry.get(activitySelectionAtom)).toBeNull();
    expect(registry.get(activityTransactionWorkflowKeyAtom)).toBeNull();

    registry.set(activitySelectionAtom, {
      providersDetails,
      selectedAction: action,
      selectedValidators: validators,
      selectedYield,
      walletScope,
    });

    expect(registry.get(activitySelectionAtom)?.selectedAction).toBe(action);
    expect(
      registry.get(activityTransactionWorkflowKeyAtom)?.actionMeta
        .providersDetails
    ).toEqual(providersDetails);
    expect(registry.get(activityTransactionWorkflowKeyAtom)?.walletScope).toBe(
      walletScope
    );

    registry.set(activitySelectionAtom, null);

    expect(registry.get(activitySelectionAtom)).toBeNull();
    expect(registry.get(activityTransactionWorkflowKeyAtom)).toBeNull();
  });

  it("discards a selection when its wallet scope is no longer current", () => {
    const action = yieldApiActionFixture();
    const walletScope = new WalletScopeKey({
      address: action.address!,
      network: "ethereum",
    });
    const registry = AtomRegistry.make({
      initialValues: [[currentWalletScopeAtom, walletScope]],
    });
    const unmount = registry.mount(activitySelectionAtom);

    registry.set(activitySelectionAtom, {
      providersDetails: [],
      selectedAction: action,
      selectedValidators: [],
      selectedYield: yieldApiYieldFixture(),
      walletScope,
    });

    expect(registry.get(activitySelectionAtom)?.selectedAction).toBe(action);

    registry.refresh(currentWalletScopeAtom);

    expect(registry.get(activitySelectionAtom)).toBeNull();

    unmount();
    registry.dispose();
  });
});
