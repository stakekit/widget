import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import { EarnValidator } from "../../src/domain/schema/earn-models";
import { WalletAddress, YieldId } from "../../src/domain/schema/identifiers";
import { EvmNetworks } from "../../src/domain/types/chains/networks";
import { tokenString } from "../../src/domain/types/tokens";
import {
  reconcileEarnMachineOwner,
  reconcileEarnMachineView,
  shouldConsumeEarnInitialization,
} from "../../src/features/earn/state/atoms-state/machine/owner";
import { applyEarnAction } from "../../src/features/earn/state/atoms-state/machine/reducer";
import { resolveCategory } from "../../src/features/earn/state/atoms-state/resolver/category";
import { resolveToken } from "../../src/features/earn/state/atoms-state/resolver/token";
import { resolveValidators } from "../../src/features/earn/state/atoms-state/resolver/validators";
import {
  resolveYield,
  resolveYieldOptions,
} from "../../src/features/earn/state/atoms-state/resolver/yield";
import {
  type EarnMachineIntent,
  type EarnMachineView,
  makeDefaultEarnIntent,
} from "../../src/features/earn/state/atoms-state/types";
import {
  WalletScopeKey,
  WalletScopeOwnerKey,
} from "../../src/services/wallet/domain/scope";
import { yieldApiValidatorFixture, yieldApiYieldFixture } from "../fixtures";

const yieldId = Schema.decodeSync(YieldId)("ethereum-eth-staking");
const walletAddress = (value: string) =>
  Schema.decodeSync(WalletAddress)(value);

describe("Earn state machine model", () => {
  it("resets all intent when the primary address owner changes", () => {
    const firstOwner = new WalletScopeOwnerKey({
      address: walletAddress("0x1111111111111111111111111111111111111111"),
      network: EvmNetworks.Ethereum,
    });
    const nextOwner = new WalletScopeOwnerKey({
      address: walletAddress("0x2222222222222222222222222222222222222222"),
      network: EvmNetworks.Ethereum,
    });
    const intent = applyEarnAction({
      action: { category: "defi", type: "category/select" },
      intent: makeDefaultEarnIntent(),
    });

    expect(
      reconcileEarnMachineOwner(
        {
          dashboardVariant: false,
          initializationConsumed: false,
          intent,
          owner: firstOwner,
        },
        nextOwner
      ).intent
    ).toEqual(makeDefaultEarnIntent());
  });

  it("does not re-arm one-time initialization when the wallet owner changes", () => {
    const firstOwner = new WalletScopeOwnerKey({
      address: walletAddress("0x1111111111111111111111111111111111111111"),
      network: EvmNetworks.Ethereum,
    });
    const nextOwner = new WalletScopeOwnerKey({
      address: walletAddress("0x2222222222222222222222222222222222222222"),
      network: EvmNetworks.Polygon,
    });

    expect(
      reconcileEarnMachineOwner(
        {
          initializationConsumed: true,
          dashboardVariant: false,
          intent: makeDefaultEarnIntent(),
          owner: firstOwner,
        },
        nextOwner
      ).initializationConsumed
    ).toBe(true);
  });

  it("waits for an account-targeted wallet scope before consuming initialization", () => {
    const readyView = { status: "ready" } as EarnMachineView;
    const initParams = {
      accountId: "0x1111111111111111111111111111111111111111",
      balanceId: null,
      network: null,
      pendingaction: null,
      tab: null,
      token: null,
      validator: null,
      yieldId,
    };
    const baseEntry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams,
      walletResolution: "settled" as const,
      walletScope: null,
    };

    expect(
      shouldConsumeEarnInitialization({ entry: baseEntry, view: readyView })
    ).toBe(false);
    expect(
      shouldConsumeEarnInitialization({
        entry: {
          ...baseEntry,
          walletScope: new WalletScopeKey({
            address: walletAddress(initParams.accountId),
            network: EvmNetworks.Ethereum,
          }),
        },
        view: readyView,
      })
    ).toBe(true);
    expect(
      shouldConsumeEarnInitialization({
        entry: {
          ...baseEntry,
          initParams: { ...initParams, accountId: null },
        },
        view: readyView,
      })
    ).toBe(true);
  });

  it("commits a resolved fallback selection into canonical intent", () => {
    const selectedYield = yieldApiYieldFixture();
    const token = {
      amount: "0",
      availableYields: [selectedYield.id],
      source: "default" as const,
      token: selectedYield.token,
    };
    const view = {
      form: {
        providerYieldId: null,
        stakeAmount: "2",
        tronResource: null,
        useMaxAmount: false,
      },
      selection: {
        category: "stake",
        token,
        validators: [],
        yield: selectedYield,
      },
      status: "ready",
    } as unknown as EarnMachineView;

    expect(
      reconcileEarnMachineView(makeDefaultEarnIntent(), view)
    ).toMatchObject({
      selectedCategory: "stake",
      selectedTokenKey: tokenString(token.token),
      selectedYieldId: selectedYield.id,
      stakeAmount: "2",
    });
  });

  it("preserves intent when the primary address and network are unchanged", () => {
    const firstOwner = new WalletScopeOwnerKey({
      address: walletAddress("0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD"),
      network: EvmNetworks.Ethereum,
    });
    const sameOwner = new WalletScopeOwnerKey({
      address: walletAddress("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
      network: EvmNetworks.Ethereum,
    });
    const state = {
      dashboardVariant: false,
      initializationConsumed: false,
      intent: applyEarnAction({
        action: { category: "defi", type: "category/select" },
        intent: makeDefaultEarnIntent(),
      }),
      owner: firstOwner,
    };

    expect(reconcileEarnMachineOwner(state, sameOwner)).toBe(state);
  });

  it("resets selection when switching between classic and dashboard modes", () => {
    const state = {
      dashboardVariant: false,
      initializationConsumed: true,
      intent: applyEarnAction({
        action: { category: "defi", type: "category/select" },
        intent: makeDefaultEarnIntent(),
      }),
      owner: null,
    };

    expect(reconcileEarnMachineOwner(state, null, true)).toEqual({
      dashboardVariant: true,
      initializationConsumed: true,
      intent: makeDefaultEarnIntent(),
      owner: null,
    });
  });

  it("preserves downstream intent when the active token is selected again", () => {
    const intent = {
      ...makeDefaultEarnIntent(),
      selectedProviderYieldId: yieldId,
      selectedTokenKey: "ethereum-eth",
      selectedYieldId: yieldId,
      stakeAmount: "4",
      tronResource: "ENERGY",
      useMaxAmount: true,
    } satisfies EarnMachineIntent;

    expect(
      applyEarnAction({
        action: { type: "token/select", tokenKey: "ethereum-eth" },
        intent,
      })
    ).toBe(intent);
  });

  it("resets token and downstream intent when category changes", () => {
    const validatorKey = "validator-a" as never;
    const intent = {
      ...makeDefaultEarnIntent(),
      selectedCategory: "stake" as const,
      selectedProviderYieldId: yieldId,
      selectedTokenKey: "ethereum-eth",
      selectedValidatorKeys: new Set([validatorKey]),
      selectedYieldId: yieldId,
      stakeAmount: "4",
      tronResource: "ENERGY",
      useMaxAmount: true,
    } satisfies EarnMachineIntent;

    expect(
      applyEarnAction({
        action: { type: "category/select", category: "defi" },
        intent,
      })
    ).toEqual({
      ...makeDefaultEarnIntent(),
      selectedCategory: "defi",
    });
  });

  it("does not remove the final selected validator", () => {
    const validatorKey = "validator-a" as never;
    const intent = {
      ...makeDefaultEarnIntent(),
      selectedValidatorKeys: new Set([validatorKey]),
    };

    expect(
      applyEarnAction({
        action: { type: "validator/remove", validatorKey },
        intent,
      })
    ).toBe(intent);
  });

  it("records an explicit zero as manual amount intent", () => {
    expect(
      applyEarnAction({
        action: { type: "stakeAmount/change", amount: "0" },
        intent: makeDefaultEarnIntent(),
      })
    ).toMatchObject({
      amountInput: "manual",
      stakeAmount: "0",
      useMaxAmount: false,
    });
  });

  it("does not invent a dashboard category after an empty discovery result", () => {
    expect(
      resolveCategory({
        availableCategories: [],
        categoryOrder: ["stake", "defi", "rwa"],
        dashboardVariant: true,
        selectedCategory: null,
      })
    ).toBeNull();
    expect(
      resolveCategory({
        availableCategories: ["stake", "defi"],
        categoryOrder: ["stake", "defi", "rwa"],
        dashboardVariant: true,
        selectedCategory: "defi",
      })
    ).toBe("defi");
    expect(
      resolveCategory({
        availableCategories: ["stake"],
        categoryOrder: ["stake", "defi", "rwa"],
        dashboardVariant: false,
        selectedCategory: "stake",
      })
    ).toBeNull();
  });

  it("does not apply token or yield preferences from another network", () => {
    const firstYield = yieldApiYieldFixture({
      id: "ethereum-eth-first",
    });
    const secondYield = yieldApiYieldFixture({
      id: "ethereum-eth-second",
    });
    const firstToken = {
      amount: "0",
      availableYields: [firstYield.id, secondYield.id],
      source: "default" as const,
      token: firstYield.token,
    };
    const secondToken = {
      ...firstToken,
      token: {
        ...firstYield.token,
        address: "0x2222222222222222222222222222222222222222" as never,
        name: "Wrapped ETH",
        symbol: "WETH",
      },
    };
    const entry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams: null,
      preferredTokenYieldsPerNetwork: {
        [EvmNetworks.Polygon]: {
          [tokenString(secondToken.token)]: secondYield.id,
        },
      },
      walletResolution: "settled" as const,
      walletScope: new WalletScopeKey({
        address: walletAddress("0x1111111111111111111111111111111111111111"),
        network: EvmNetworks.Ethereum,
      }),
    };

    expect(
      resolveToken({
        entry,
        selectedTokenKey: null,
        tokenOptions: [firstToken, secondToken],
      })
    ).toBe(firstToken);
    expect(
      resolveYield({
        entry: {
          ...entry,
          preferredTokenYieldsPerNetwork: {
            [EvmNetworks.Polygon]: {
              [tokenString(firstToken.token)]: secondYield.id,
            },
          },
        },
        positionsData: new Map(),
        selectedToken: firstToken,
        selectedYieldId: null,
        yieldOptions: [firstYield, secondYield],
      })
    ).toBe(firstYield);
    expect(
      resolveToken({
        entry: { ...entry, walletScope: null },
        selectedTokenKey: null,
        tokenOptions: [firstToken, secondToken],
      })
    ).toBe(secondToken);
  });

  it("covers every intent command and reset boundary", () => {
    const firstValidator = "validator-a" as never;
    const secondValidator = "validator-b" as never;
    const otherYield = Schema.decodeSync(YieldId)("ethereum-eth-other");
    const populated = {
      ...makeDefaultEarnIntent(),
      amountInput: "manual" as const,
      selectedCategory: "stake" as const,
      selectedProviderYieldId: yieldId,
      selectedTokenKey: "ethereum-eth",
      selectedValidatorKeys: new Set([firstValidator, secondValidator]),
      selectedYieldId: yieldId,
      stakeAmount: "5",
      tronResource: "ENERGY",
      useMaxAmount: true,
    } satisfies EarnMachineIntent;

    expect(
      applyEarnAction({
        action: { tokenKey: "ethereum-usdc", type: "token/select" },
        intent: populated,
      })
    ).toEqual({
      ...makeDefaultEarnIntent(),
      selectedCategory: "stake",
      selectedTokenKey: "ethereum-usdc",
    });
    expect(
      applyEarnAction({
        action: { type: "yield/select", yieldId },
        intent: populated,
      })
    ).toBe(populated);
    expect(
      applyEarnAction({
        action: { type: "yield/select", yieldId: otherYield },
        intent: populated,
      })
    ).toEqual({
      ...populated,
      amountInput: "untouched",
      selectedProviderYieldId: null,
      selectedValidatorKeys: new Set(),
      selectedYieldId: otherYield,
      stakeAmount: "0",
      tronResource: null,
      useMaxAmount: false,
    });
    expect(
      applyEarnAction({
        action: { category: "stake", type: "category/select" },
        intent: populated,
      })
    ).toBe(populated);
    expect(
      applyEarnAction({
        action: { type: "validator/select", validatorKey: firstValidator },
        intent: makeDefaultEarnIntent(),
      }).selectedValidatorKeys
    ).toEqual(new Set([firstValidator]));
    const oneValidator = {
      ...makeDefaultEarnIntent(),
      selectedValidatorKeys: new Set([firstValidator]),
    };
    expect(
      applyEarnAction({
        action: {
          type: "validator/multiselect",
          validatorKey: secondValidator,
        },
        intent: oneValidator,
      }).selectedValidatorKeys
    ).toEqual(new Set([firstValidator, secondValidator]));
    expect(
      applyEarnAction({
        action: {
          type: "validator/multiselect",
          validatorKey: firstValidator,
        },
        intent: oneValidator,
      })
    ).toBe(oneValidator);
    expect(
      applyEarnAction({
        action: { type: "validator/remove", validatorKey: firstValidator },
        intent: populated,
      }).selectedValidatorKeys
    ).toEqual(new Set([secondValidator]));
    expect(
      applyEarnAction({
        action: {
          providerYieldId: otherYield,
          type: "providerYieldId/select",
        },
        intent: populated,
      }).selectedProviderYieldId
    ).toBe(otherYield);
    expect(
      applyEarnAction({
        action: { amount: "9", type: "stakeAmount/max" },
        intent: populated,
      })
    ).toMatchObject({
      amountInput: "max",
      stakeAmount: "9",
      useMaxAmount: true,
    });
    expect(
      applyEarnAction({
        action: { tronResource: "BANDWIDTH", type: "tronResource/select" },
        intent: populated,
      }).tronResource
    ).toBe("BANDWIDTH");
  });

  it("applies token precedence across explicit, init-yield, init-token, preferred, and fallback", () => {
    const firstYield = yieldApiYieldFixture({ id: "ethereum-eth-first" });
    const secondYield = yieldApiYieldFixture({ id: "ethereum-weth-second" });
    const first = {
      amount: "1",
      availableYields: [firstYield.id],
      source: "balance" as const,
      token: {
        ...firstYield.token,
        address: "0x1111111111111111111111111111111111111111" as never,
      },
    };
    const second = {
      amount: "0",
      availableYields: [secondYield.id],
      source: "default" as const,
      token: {
        ...secondYield.token,
        address: "0x2222222222222222222222222222222222222222" as never,
        symbol: "WETH",
      },
    };
    const baseEntry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams: null,
      walletResolution: "settled" as const,
      walletScope: new WalletScopeKey({
        address: walletAddress("0x9999999999999999999999999999999999999999"),
        network: EvmNetworks.Ethereum,
      }),
    };
    const initParams = {
      accountId: null,
      balanceId: null,
      network: EvmNetworks.Ethereum,
      pendingaction: null,
      tab: null,
      token: null,
      validator: null,
      yieldId: null,
    };

    expect(
      resolveToken({
        entry: baseEntry,
        selectedTokenKey: tokenString(second.token),
        tokenOptions: [first, second],
      })
    ).toBe(second);
    expect(
      resolveToken({
        entry: {
          ...baseEntry,
          initParams: { ...initParams, yieldId: secondYield.id },
        },
        selectedTokenKey: "missing",
        tokenOptions: [first, second],
      })
    ).toBe(second);
    expect(
      resolveToken({
        entry: {
          ...baseEntry,
          initParams: { ...initParams, token: "weth" },
        },
        selectedTokenKey: null,
        tokenOptions: [first, second],
      })
    ).toBe(second);
    expect(
      resolveToken({
        entry: {
          ...baseEntry,
          preferredTokenYieldsPerNetwork: {
            [EvmNetworks.Ethereum]: {
              [tokenString(second.token)]: secondYield.id,
            },
          },
        },
        selectedTokenKey: null,
        tokenOptions: [first, second],
      })
    ).toBe(second);
    expect(
      resolveToken({
        entry: baseEntry,
        selectedTokenKey: null,
        tokenOptions: [first, second],
      })
    ).toBe(first);
    expect(
      resolveToken({
        entry: baseEntry,
        selectedTokenKey: null,
        tokenOptions: [],
      })
    ).toBeNull();
  });

  it("applies yield visibility and explicit, init, preferred, and star precedence", () => {
    const first = yieldApiYieldFixture({
      id: "ethereum-eth-first",
      rewardRate: { components: [], rateType: "APY", total: 0 },
    });
    const second = yieldApiYieldFixture({ id: "ethereum-eth-second" });
    const disabled = yieldApiYieldFixture({
      id: "ethereum-eth-disabled",
      status: { enter: false, exit: true },
    });
    const selectedToken = {
      amount: "100",
      availableYields: [first.id, second.id, disabled.id],
      source: "balance" as const,
      token: first.token,
    };
    const baseEntry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams: null,
      walletResolution: "settled" as const,
      walletScope: null,
    };
    const options = resolveYieldOptions({
      selectedToken,
      yieldsById: [first, second, disabled],
    });

    expect(
      resolveYieldOptions({ selectedToken: null, yieldsById: options })
    ).toEqual([]);
    expect(options).toEqual([first, second]);
    expect(
      resolveYield({
        entry: baseEntry,
        positionsData: new Map(),
        selectedToken,
        selectedYieldId: second.id,
        yieldOptions: options,
      })
    ).toBe(second);
    expect(
      resolveYield({
        entry: {
          ...baseEntry,
          initParams: {
            accountId: null,
            balanceId: null,
            network: null,
            pendingaction: null,
            tab: null,
            token: null,
            validator: null,
            yieldId: second.id,
          },
        },
        positionsData: new Map(),
        selectedToken,
        selectedYieldId: null,
        yieldOptions: options,
      })
    ).toBe(second);
    expect(
      resolveYield({
        entry: {
          ...baseEntry,
          preferredTokenYieldsPerNetwork: {
            [EvmNetworks.Ethereum]: {
              [tokenString(selectedToken.token)]: second.id,
            },
          },
        },
        positionsData: new Map(),
        selectedToken,
        selectedYieldId: null,
        yieldOptions: options,
      })
    ).toBe(second);
    expect(
      resolveYield({
        entry: {
          ...baseEntry,
          preferredTokenYieldsPerNetwork: {
            [EvmNetworks.Ethereum]: {
              [tokenString(selectedToken.token)]: "*",
            },
          },
        },
        positionsData: new Map(),
        selectedToken,
        selectedYieldId: null,
        yieldOptions: options,
      })
    ).toBe(second);
  });

  it("resolves validators from retained intent, one-time init, and fallback", () => {
    const first = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture({ address: "0xfirst", name: "First" })
    );
    const second = Schema.decodeSync(EarnValidator)(
      yieldApiValidatorFixture({ address: "0xsecond", name: "Second" })
    );
    const baseEntry = {
      categoryOrder: [],
      dashboardVariant: false,
      initParams: null,
      walletResolution: "settled" as const,
      walletScope: null,
    };

    expect(
      resolveValidators({
        entry: baseEntry,
        selectedValidatorKeys: new Set(),
        validatorOptions: [],
      })
    ).toEqual([]);
    expect(
      resolveValidators({
        entry: baseEntry,
        selectedValidatorKeys: new Set([second.key]),
        validatorOptions: [first, second],
      })
    ).toEqual([second]);
    expect(
      resolveValidators({
        entry: {
          ...baseEntry,
          initParams: {
            accountId: null,
            balanceId: null,
            network: null,
            pendingaction: null,
            tab: null,
            token: null,
            validator: "second",
            yieldId: null,
          },
        },
        selectedValidatorKeys: new Set(),
        validatorOptions: [first, second],
      })
    ).toEqual([second]);
    expect(
      resolveValidators({
        entry: baseEntry,
        selectedValidatorKeys: new Set(),
        validatorOptions: [first, second],
      })
    ).toEqual([first]);
  });
});
