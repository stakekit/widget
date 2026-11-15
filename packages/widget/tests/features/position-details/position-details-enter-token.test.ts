import BigNumber from "bignumber.js";
import { Effect, Layer, Option, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { sepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";

import { EarnBalance } from "../../../src/domain/earn/balance";
import { ConfidentialTokenBalanceKey } from "../../../src/domain/earn/confidential-balance";
import type { EarnYield } from "../../../src/domain/earn/yield-schema";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { Token } from "../../../src/domain/token/token";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { tokenBalancesScanAtom } from "../../../src/features/portfolio/index";
import { PositionDetailsEnterKey } from "../../../src/features/position-details/state/enter-entry";
import { positionDetailsEnterAtoms } from "../../../src/features/position-details/state/enter-view";
import {
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../../src/features/wallet/index";
import { yieldFlowRoutes } from "../../../src/features/yield-transaction-flow/model/session";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesAtom,
  positionBalancesByTypeAtom,
} from "../../../src/resources/yield-positions/yield-positions";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { walletRuntime } from "../../../src/runtime/wallet-runtime";
import {
  ResponseDecodeError,
  type ValidatorDirectoryRequest,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { makeWidgetNavigation } from "../../../src/services/navigation/widget-navigation";
import {
  type WidgetNavigationTarget,
  widgetTargetPath,
  widgetTargetState,
} from "../../../src/services/navigation/widget-routes";
import type { NormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import { RevealedBalances } from "../../../src/services/zama/revealed-balances";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiValidatorFixture,
  yieldApiYieldFixture,
  yieldBalanceFixture,
} from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { emptyProviderList } from "../../utils/services/resource-sources";
import { makeTestTracking } from "../../utils/services/tracking-service";
import { makeTestNavigation } from "../../utils/services/widget-navigation";
import { makeTestZamaLayer } from "../../utils/services/zama-service";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";
import { makeYieldFlowTestKit } from "../../utils/yield-flow-test-kit";

const { cUsdc, usdc } = confidentialFixture;
const address = Schema.decodeSync(WalletAddress)(
  "0x1234567890123456789012345678901234567890"
);
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum-sepolia",
});
const connectedWalletState = {
  additionalAddresses: null,
  address,
  chain: sepolia,
  connector: { id: "test", uid: "test" } as Connector,
  connectorChains: [sepolia],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum-sepolia",
  status: "connected",
} satisfies NormalizedWalletState;
// The live API lists both the underlying and its confidential wrapper.
const vault = confidentialYieldFixture({ inputTokens: [usdc, cUsdc] });

const addTokenBalanceAtom = appRuntime.fn(
  ({ balance, key }: { balance: bigint; key: ConfidentialTokenBalanceKey }) =>
    RevealedBalances.use((values) => values.addTokenBalance(key, balance))
);

const makeRegistry = (
  selectedYield: EarnYield,
  initialValues: NonNullable<
    NonNullable<Parameters<typeof AtomRegistry.make>[0]>["initialValues"]
  > = []
) => {
  const reveals: Array<{ chainId: number; owner: string; token: string }> = [];
  const entryKey = new PositionDetailsEnterKey({
    balanceId: "default",
    integrationId: selectedYield.id,
    walletScope,
  });
  const registry: AtomRegistry.AtomRegistry = AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(walletScopeAtom, walletScope),
      Atom.initialValue(walletConnectionStateAtom, connectedWalletState),
      Atom.initialValue(
        yieldOpportunityAtom.local(
          new YieldOpportunityKey({ yieldId: selectedYield.id })
        ),
        AsyncResult.success(selectedYield)
      ),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(Reactivity.layer, RevealedBalances.layer) as never
      ),
      Atom.initialValue(
        walletRuntime.layer,
        makeTestZamaLayer({
          revealTokenBalance: ({ chainId, owner, token }) =>
            Effect.sync(() => {
              reveals.push({ chainId, owner, token: token.symbol });
              registry.set(addTokenBalanceAtom, {
                balance: 5_000_000n,
                key: new ConfidentialTokenBalanceKey({ owner, token }),
              });
              return 5_000_000n;
            }),
        }) as never
      ),
      ...initialValues,
    ],
  });
  return { entryKey, registry, reveals };
};

describe("Position details stake token", () => {
  it("gives every read of a key the same Atoms", () => {
    const { entryKey, registry } = makeRegistry(yieldApiYieldFixture());
    const atomsAtom = positionDetailsEnterAtoms(entryKey);
    const unmount = registry.mount(atomsAtom);

    try {
      expect(positionDetailsEnterAtoms(entryKey)).toBe(atomsAtom);
      expect(registry.get(positionDetailsEnterAtoms(entryKey))).toBe(
        registry.get(atomsAtom)
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps the static yield token when the yield accepts only it", async () => {
    const selectedYield = yieldApiYieldFixture();
    const { entryKey, registry } = makeRegistry(selectedYield);
    const { viewAtom } = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).selectedToken?.symbol).toBe(
          selectedYield.token.symbol
        )
      );
      expect(registry.get(viewAtom).tokenSelection).toMatchObject({
        options: [{ selected: true, token: { symbol: "ETH" } }],
        selectable: false,
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("offers the confidential wrapper beside the yield token", async () => {
    const { entryKey, registry } = makeRegistry(vault);
    const { viewAtom } = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).tokenSelection.selectable).toBe(true)
      );
      const view = registry.get(viewAtom);
      expect(view.selectedToken?.symbol).toBe("USDC");
      expect(view.hiddenTokenBalance).toBe(false);
      expect(
        view.tokenSelection.options.map((option) => ({
          hiddenBalance: option.hiddenBalance,
          selected: option.selected,
          symbol: option.token.symbol,
        }))
      ).toEqual([
        { hiddenBalance: false, selected: true, symbol: "USDC" },
        { hiddenBalance: true, selected: false, symbol: "cUSDC" },
      ]);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  // Symbols differ between the Yield API and the wallet scan (WBTC, wBTC).
  const wbtc = {
    address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    decimals: 8,
    name: "Wrapped Bitcoin",
    network: "ethereum-sepolia" as const,
    symbol: "wBTC",
  };
  const scannedWbtc = {
    ...wbtc,
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    name: "Wrapped BTC",
    symbol: "WBTC",
  };
  it.each([
    {
      name: "reads a scanned token's balance by contract when its symbol differs",
      scannedToken: scannedWbtc,
      expectedAmount: "0.00000609",
    },
    {
      name: "does not read another contract with the same symbol",
      scannedToken: {
        ...wbtc,
        address: "0x0000000000000000000000000000000000000001",
      },
      expectedAmount: "0",
    },
    {
      name: "does not read the same address on another network",
      scannedToken: { ...scannedWbtc, network: "base" },
      expectedAmount: "0",
    },
  ])("$name", async ({ scannedToken, expectedAmount }) => {
    const selectedYield = yieldApiYieldFixture({
      id: "ethereum-wbtc-dbit-makina-vault",
      token: wbtc,
      inputTokens: [wbtc],
    });
    const { entryKey, registry } = makeRegistry(selectedYield, [
      Atom.initialValue(tokenBalancesScanAtom, {
        enabled: true,
        result: AsyncResult.success([
          {
            amount: new BigNumber("0.00000609"),
            availableYields: [selectedYield.id],
            token: Schema.decodeUnknownSync(Token)(scannedToken),
          },
        ]),
      }),
      Atom.initialValue(
        positionBalancesByTypeAtom(
          new PositionBalancesKey({
            balanceId: "default",
            scope: walletScope,
            yieldId: selectedYield.id,
          })
        ),
        AsyncResult.success(new Map())
      ),
    ]);
    const { viewAtom } = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() => {
        expect(registry.get(viewAtom).ownerCurrent).toBe(true);
      });
      const view = registry.get(viewAtom);
      expect(view.selectedTokenAvailableAmount?.amount.toFixed()).toBe(
        expectedAmount
      );
      expect(view.tokenSelection.options[0]?.amount?.toFixed()).toBe(
        expectedAmount
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("enters with the confidential wrapper and reveals and hides its balance", async () => {
    const { entryKey, registry, reveals } = makeRegistry(vault);
    const atoms = registry.get(positionDetailsEnterAtoms(entryKey));
    const { viewAtom } = atoms;
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).tokenSelection.selectable).toBe(true)
      );
      const wrapper = registry
        .get(viewAtom)
        .tokenSelection.options.find(
          (option) => option.token.symbol === "cUSDC"
        )?.token;
      if (!wrapper) throw new Error("missing confidential wrapper option");

      registry.set(atoms.selectTokenAtom, wrapper);
      expect(registry.get(viewAtom)).toMatchObject({
        canUseMax: false,
        hiddenTokenBalance: true,
        revealedTokenBalance: false,
        selectedToken: { symbol: "cUSDC" },
        selectedTokenAvailableAmount: null,
      });

      registry.set(atoms.revealTokenBalanceAtom, undefined);
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).revealedTokenBalance).toBe(true)
      );
      expect(reveals).toEqual([
        { chainId: sepolia.id, owner: address, token: "cUSDC" },
      ]);
      const revealed = registry.get(viewAtom);
      expect(revealed.hiddenTokenBalance).toBe(false);
      expect(revealed.canUseMax).toBe(true);
      expect(revealed.selectedTokenAvailableAmount?.amount.toFixed()).toBe("5");

      registry.set(atoms.setAmountAtom, new BigNumber(2));
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).preparation).toMatchObject({
          command: { arguments: { inputToken: cUsdc.address } },
          selectedToken: { symbol: "cUSDC" },
        })
      );

      registry.set(atoms.hideTokenBalanceAtom, undefined);
      await vi.waitFor(() =>
        expect(registry.get(viewAtom)).toMatchObject({
          canUseMax: false,
          hiddenTokenBalance: true,
          revealedTokenBalance: false,
          selectedTokenAvailableAmount: null,
        })
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});

const ethereumScope = new WalletScopeKey({ address, network: "ethereum" });

describe("Position details stake validators", () => {
  it("stakes more with the validator that holds the position", async () => {
    const baseYield = yieldApiYieldFixture();
    const validatorYield: EarnYield = {
      ...baseYield,
      mechanics: { ...baseYield.mechanics, requiresValidatorSelection: true },
    };
    const catalogFirst = yieldApiValidatorFixture({
      address: "0x1111111111111111111111111111111111111111",
      name: "Catalog first",
    });
    const positionValidator = yieldApiValidatorFixture({
      address: "0x2222222222222222222222222222222222222222",
      name: "Position validator",
    });
    const entryKey = new PositionDetailsEnterKey({
      balanceId: "default",
      integrationId: validatorYield.id,
      walletScope: ethereumScope,
    });
    const balance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({
        token: validatorYield.token,
        validator: positionValidator,
      })
    );
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, ethereumScope),
        Atom.initialValue(
          yieldOpportunityAtom.local(
            new YieldOpportunityKey({ yieldId: validatorYield.id })
          ),
          AsyncResult.success(validatorYield)
        ),
        Atom.initialValue(
          positionBalancesAtom(
            new PositionBalancesKey({
              balanceId: entryKey.balanceId,
              scope: ethereumScope,
              yieldId: validatorYield.id,
            })
          ),
          AsyncResult.success({ balances: [balance], type: "default" } as never)
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                listValidators: (request: ValidatorDirectoryRequest) =>
                  Effect.succeed({
                    items: request.preferred
                      ? []
                      : [
                          { ...catalogFirst, key: catalogFirst.address },
                          {
                            ...positionValidator,
                            key: positionValidator.address,
                          },
                        ],
                    limit: request.limit,
                    offset: request.offset,
                    total: request.preferred ? 0 : 2,
                  }),
              } as never)
            )
          ) as never
        ),
      ],
    });
    const { viewAtom } = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() =>
        expect(
          [...registry.get(viewAtom).selectedValidators.values()].map(
            (validator) => validator.address
          )
        ).toEqual([positionValidator.address])
      );
    } finally {
      unmount();
      registry.dispose();
    }
  });
});

describe("Position details stake entry load", () => {
  it("fails, not loads, when the yield's first load fails, and retries it", async () => {
    const selectedYield = yieldApiYieldFixture();
    const balance = Schema.decodeSync(EarnBalance)(
      yieldBalanceFixture({ address, amount: "1", token: selectedYield.token })
    );
    const getOpportunity = vi
      .fn()
      .mockReturnValueOnce(
        Effect.fail(
          new ResponseDecodeError({
            cause: null,
            issue: "unexpected response",
            operation: "getOpportunity",
          })
        )
      )
      .mockReturnValue(Effect.succeed(selectedYield));
    const entryKey = new PositionDetailsEnterKey({
      balanceId: "default",
      integrationId: selectedYield.id,
      walletScope: ethereumScope,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, ethereumScope),
        Atom.initialValue(
          positionBalancesAtom(
            new PositionBalancesKey({
              balanceId: entryKey.balanceId,
              scope: ethereumScope,
              yieldId: selectedYield.id,
            })
          ),
          AsyncResult.success({
            balances: [balance],
            rewardRate: null,
            type: "default",
          }) as never
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(
            Reactivity.layer,
            Layer.succeed(
              YieldResourceSource,
              YieldResourceSource.of({
                getOpportunity,
                getPositions: () => Effect.never,
                listProviders: emptyProviderList,
              } as never)
            )
          ) as never
        ),
      ],
    });
    const atoms = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(atoms.viewAtom);

    try {
      await vi.waitFor(() =>
        expect(registry.get(atoms.viewAtom).status).toEqual({ _tag: "Failed" })
      );

      registry.set(atoms.retryAtom, undefined);

      await vi.waitFor(() =>
        expect(registry.get(atoms.viewAtom).status).toEqual({ _tag: "Ready" })
      );
      expect(getOpportunity).toHaveBeenCalledTimes(2);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});

describe("Position details stake submission", () => {
  it("starts a stake-more Session and pushes its Review", async () => {
    const selectedYield = yieldApiYieldFixture();
    const walletState = makeConnectedWalletState(ethereumScope);
    const push = vi.fn<(to: WidgetNavigationTarget) => void>();
    const navigation = makeWidgetNavigation({
      back: () => Effect.void,
      push: (to) => Effect.sync(() => push(to)),
      replace: () => Effect.void,
    });
    const entryKey = new PositionDetailsEnterKey({
      balanceId: "default",
      integrationId: selectedYield.id,
      walletScope: ethereumScope,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, ethereumScope),
        Atom.initialValue(walletConnectionStateAtom, walletState.connection),
        Atom.initialValue(
          yieldOpportunityAtom.local(
            new YieldOpportunityKey({ yieldId: selectedYield.id })
          ),
          AsyncResult.success(selectedYield)
        ),
        Atom.initialValue(tokenBalancesScanAtom, {
          enabled: true,
          result: AsyncResult.success([
            {
              amount: new BigNumber(10),
              availableYields: [selectedYield.id],
              token: selectedYield.token,
            },
          ]),
        } as never),
        Atom.initialValue(
          positionBalancesByTypeAtom(
            new PositionBalancesKey({
              balanceId: entryKey.balanceId,
              scope: ethereumScope,
              yieldId: selectedYield.id,
            })
          ),
          AsyncResult.success(new Map()) as never
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.unwrap(
            Effect.all({
              navigation: makeTestNavigation({ execute: navigation.execute }),
              tracking: makeTestTracking(),
            }).pipe(
              Effect.map(({ navigation: testNavigation, tracking }) =>
                Layer.mergeAll(
                  Reactivity.layer,
                  testNavigation.layer,
                  tracking.layer
                )
              )
            )
          ) as never
        ),
        Atom.initialValue(
          walletRuntime.layer,
          Layer.unwrap(
            makeYieldFlowTestKit({
              initialWalletState: walletState,
              navigation: { execute: navigation.execute },
            }).pipe(Effect.map((kit) => kit.layer))
          ) as never
        ),
      ],
    });
    const atoms = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(atoms.viewAtom);

    try {
      registry.set(atoms.setAmountAtom, new BigNumber(1));
      await vi.waitFor(() =>
        expect(registry.get(atoms.viewAtom).cta).toMatchObject({
          _tag: "Submit",
          disabled: false,
        })
      );
      registry.set(atoms.submitAtom, undefined);

      await vi.waitFor(() => expect(push).toHaveBeenCalledOnce());
      const [to] = push.mock.calls[0] ?? [];
      if (to === undefined) throw new Error("Expected a Review navigation");
      expect(widgetTargetPath(to)).toBe(
        `/positions/${selectedYield.id}/default/stake/review`
      );
      expect(
        Option.getOrThrow(
          yieldFlowRoutes.PositionStake.state(widgetTargetState(to))
        ).yieldFlowSession
      ).toMatchObject({
        intake: { _tag: "Enter", selectedStake: { id: selectedYield.id } },
        mount: { _tag: "PositionStake", balanceId: "default" },
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
