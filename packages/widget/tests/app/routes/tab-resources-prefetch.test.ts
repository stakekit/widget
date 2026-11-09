import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";

import { tabResourcesPrefetchAtom } from "../../../src/app/routes/state/tab-resources-prefetch";
import { applicationRouterLocationAtom } from "../../../src/app/runtime/application-router";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../../src/features/wallet/index";
import { appRuntime } from "../../../src/runtime/app-runtime";
import type { YieldResourceSource } from "../../../src/services/api/resource-sources";
import { unconfiguredBorrowResourceSourceLayer } from "../../utils/services/borrow-resource-source";
import {
  legacyResourceSourceLayer,
  yieldResourceSourceLayer,
} from "../../utils/services/resource-sources";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const address = Schema.decodeSync(
  Schema.NonEmptyString.pipe(Schema.brand("WalletAddress"))
)("0x0000000000000000000000000000000000000001");
const walletScope = new WalletScopeKey({
  address,
  network: "ethereum",
});
const connectedWallet = {
  additionalAddresses: null,
  address,
  chain: {} as never,
  connector: {} as never,
  connectorChains: [],
  isLedgerLive: false,
  isLedgerLiveAccountPlaceholder: false,
  ledgerAccounts: [],
  network: "ethereum" as const,
  status: "connected" as const,
};

type ListActivity = YieldResourceSource["Service"]["listActivity"];
type GetPositions = YieldResourceSource["Service"]["getPositions"];

const makeRegistry = ({
  getPositions,
  listActivity,
}: {
  readonly getPositions: GetPositions;
  readonly listActivity: ListActivity;
}) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(applicationRouterLocationAtom, {
        pathname: "/positions",
      }),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          yieldResourceSourceLayer({ getPositions, listActivity }),
          legacyResourceSourceLayer({
            scanTokenBalances: () => Effect.succeed([]),
          }),
          unconfiguredBorrowResourceSourceLayer
        )
      ),
      Atom.initialValue(
        walletConfigResultAtom,
        AsyncResult.success({} as never)
      ),
      Atom.initialValue(walletConnectionStateAtom, connectedWallet),
      Atom.initialValue(walletScopeAtom, walletScope),
    ],
  });

describe("tab resources prefetch", () => {
  it("warms Manage positions and Activity All when scoped on Manage", async () => {
    const getPositions = vi.fn<GetPositions>(() =>
      Effect.succeed({ errors: [], items: [] })
    );
    const listActivity = vi.fn<ListActivity>((request) =>
      Effect.succeed({
        items: [],
        limit: request.limit ?? 50,
        offset: request.offset ?? 0,
        total: 0,
      })
    );
    const registry = makeRegistry({ getPositions, listActivity });
    const unmount = registry.mount(tabResourcesPrefetchAtom);

    try {
      await vi.waitFor(() => {
        expect(registry.get(tabResourcesPrefetchAtom)).toBe("warming");
        expect(getPositions).toHaveBeenCalled();
        expect(
          listActivity.mock.calls.some(
            ([request]) =>
              request.limit === 50 && request.yieldTypes === undefined
          )
        ).toBe(true);
      });
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
