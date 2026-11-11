import BigNumber from "bignumber.js";
import { Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it, vi } from "vitest";

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
import {
  YieldOpportunityKey,
  yieldOpportunityAtom,
} from "../../../src/resources/yield-opportunity/provider";
import {
  PositionBalancesKey,
  positionBalancesByTypeAtom,
} from "../../../src/resources/yield-positions/yield-positions";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { RevealedBalances } from "../../../src/services/zama/revealed-balances";
import { yieldApiYieldFixture } from "../../fixtures";
import { makeConnectedWalletState } from "../../fixtures/wallet-state";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

// Real token identities returned by the local Yield API and legacy wallet scan.
const wbtc = {
  address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  decimals: 8,
  name: "Wrapped Bitcoin",
  network: "ethereum" as const,
  symbol: "wBTC",
};
const scannedWbtc = {
  ...wbtc,
  address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
  name: "Wrapped BTC",
  symbol: "WBTC",
};
const walletAmount = "0.00000609";

describe("Makina DBIT available balance in Manage", () => {
  it.each([
    {
      name: "recognizes WBTC from the wallet scan as the vault's wBTC",
      scannedToken: scannedWbtc,
      expectedAmount: walletAmount,
    },
    {
      name: "does not use another contract with the same symbol",
      scannedToken: {
        ...wbtc,
        address: "0x0000000000000000000000000000000000000001",
      },
      expectedAmount: "0",
    },
    {
      name: "does not use the same address on another network",
      scannedToken: { ...scannedWbtc, network: "base" },
      expectedAmount: "0",
    },
  ])("$name", async ({ scannedToken, expectedAmount }) => {
    const scope = new WalletScopeKey({
      address: Schema.decodeSync(WalletAddress)(
        "0xe6B5b5FaCD8D6a633a4d87d5E9beb6ee2389Cd65"
      ),
      network: "ethereum",
    });
    const selectedYield = yieldApiYieldFixture({
      id: "ethereum-wbtc-dbit-makina-vault",
      token: wbtc,
      inputTokens: [wbtc],
    });
    const entryKey = new PositionDetailsEnterKey({
      balanceId: "default",
      integrationId: selectedYield.id,
      walletScope: scope,
    });
    const registry = AtomRegistry.make({
      initialValues: [
        applicationRuntimeInitInitialValue(),
        Atom.initialValue(walletScopeAtom, scope),
        Atom.initialValue(
          walletConnectionStateAtom,
          makeConnectedWalletState(scope).connection
        ),
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
              amount: new BigNumber(walletAmount),
              availableYields: [selectedYield.id],
              token: Schema.decodeUnknownSync(Token)(scannedToken),
            },
          ]),
        }),
        Atom.initialValue(
          positionBalancesByTypeAtom(
            new PositionBalancesKey({
              balanceId: entryKey.balanceId,
              scope,
              yieldId: selectedYield.id,
            })
          ),
          AsyncResult.success(new Map())
        ),
        Atom.initialValue(
          appRuntime.layer,
          Layer.mergeAll(Reactivity.layer, RevealedBalances.layer) as never
        ),
      ],
    });
    const { viewAtom } = registry.get(positionDetailsEnterAtoms(entryKey));
    const unmount = registry.mount(viewAtom);

    try {
      await vi.waitFor(() => {
        const view = registry.get(viewAtom);
        expect(view.selectedToken?.symbol).toBe("wBTC");
        expect(view.ownerCurrent).toBe(true);
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
});
