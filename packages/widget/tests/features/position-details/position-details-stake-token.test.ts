import BigNumber from "bignumber.js";
import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { sepolia } from "viem/chains";
import { describe, expect, it, vi } from "vitest";
import type { Connector } from "wagmi";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { walletRuntime } from "../../../src/app/runtime/wallet-runtime";
import { ConfidentialTokenBalanceKey } from "../../../src/domain/earn/confidential";
import type { EarnYield } from "../../../src/domain/earn/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { PositionDetailsStakeEntryKey } from "../../../src/features/position-details/state/stake-entry";
import {
  hidePositionDetailsStakeTokenBalanceAtom,
  positionDetailsStakeViewAtom,
  revealPositionDetailsStakeTokenBalanceAtom,
  selectPositionDetailsStakeTokenAtom,
  setPositionDetailsStakeAmountAtom,
} from "../../../src/features/position-details/state/stake-view";
import {
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../../src/features/wallet/index";
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../src/resources/yield-opportunity/provider";
import type { NormalizedWalletState } from "../../../src/services/wallet/wallet-state";
import { RevealedBalances } from "../../../src/services/zama/revealed-balances";
import {
  confidentialFixture,
  confidentialYieldFixture,
  yieldApiYieldFixture,
} from "../../fixtures";
import { makeTestZamaLayer } from "../../utils/services/zama-service";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

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

const makeRegistry = (selectedYield: EarnYield) => {
  const reveals: Array<{ chainId: number; owner: string; token: string }> = [];
  const entryKey = new PositionDetailsStakeEntryKey({
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
    ],
  });
  return { entryKey, registry, reveals };
};

describe("Position details stake token", () => {
  it("keeps the static yield token when the yield accepts only it", async () => {
    const selectedYield = yieldApiYieldFixture();
    const { entryKey, registry } = makeRegistry(selectedYield);
    const viewAtom = positionDetailsStakeViewAtom(entryKey);
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
    const viewAtom = positionDetailsStakeViewAtom(entryKey);
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

  it("enters with the confidential wrapper and reveals and hides its balance", async () => {
    const { entryKey, registry, reveals } = makeRegistry(vault);
    const viewAtom = positionDetailsStakeViewAtom(entryKey);
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

      registry.set(selectPositionDetailsStakeTokenAtom(entryKey), wrapper);
      expect(registry.get(viewAtom)).toMatchObject({
        canUseMax: false,
        hiddenTokenBalance: true,
        revealedTokenBalance: false,
        selectedToken: { symbol: "cUSDC" },
        selectedTokenAvailableAmount: null,
      });

      registry.set(
        revealPositionDetailsStakeTokenBalanceAtom(entryKey),
        undefined
      );
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

      registry.set(
        setPositionDetailsStakeAmountAtom(entryKey),
        new BigNumber(2)
      );
      await vi.waitFor(() =>
        expect(registry.get(viewAtom).preparation).toMatchObject({
          command: { arguments: { inputToken: cUsdc.address } },
          selectedToken: { symbol: "cUSDC" },
        })
      );

      registry.set(
        hidePositionDetailsStakeTokenBalanceAtom(entryKey),
        undefined
      );
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
