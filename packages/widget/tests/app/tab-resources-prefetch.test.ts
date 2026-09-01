import { Effect, Layer, Schema } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it, vi } from "vitest";
import { tabResourcesPrefetchAtom } from "../../src/app/routes/state/tab-resources-prefetch";
import { appRuntime } from "../../src/app/runtime/app-runtime";
import { applicationRouterPathnameAtom } from "../../src/app/runtime/application-router";
import { WalletScopeKey } from "../../src/domain/wallet/wallet-scope";
import {
  walletConfigResultAtom,
  walletConnectionStateAtom,
  walletScopeAtom,
} from "../../src/features/wallet/index";
import {
  LegacyResourceSource,
  YieldResourceSource,
} from "../../src/services/api/resource-sources";
import { applicationRuntimeInitInitialValue } from "../utils/widget-config";

const address = Schema.decodeUnknownSync(
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
const disconnectedWallet = {
  additionalAddresses: null,
  address: null,
  chain: null,
  connector: null,
  connectorChains: [] as never[],
  isLedgerLive: false as const,
  isLedgerLiveAccountPlaceholder: false as const,
  ledgerAccounts: null,
  network: null,
  status: "disconnected" as const,
};

type ListActivity = YieldResourceSource["Service"]["listActivity"];
type GetPositions = YieldResourceSource["Service"]["getPositions"];

const makeRegistry = ({
  getPositions,
  listActivity,
  pathname = "/positions",
  scope = walletScope,
}: {
  readonly getPositions: GetPositions;
  readonly listActivity: ListActivity;
  readonly pathname?: string;
  readonly scope?: WalletScopeKey | null;
}) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(applicationRouterPathnameAtom, pathname),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Layer.succeed(
            YieldResourceSource,
            YieldResourceSource.of({
              getOpportunity: () => Effect.succeed({} as never),
              getPositions,
              getProvider: () => Effect.succeed({} as never),
              listActivity,
            } as never)
          ),
          Layer.succeed(
            LegacyResourceSource,
            LegacyResourceSource.of({
              scanTokenBalances: () => Effect.succeed([]),
            } as never)
          )
        )
      ),
      Atom.initialValue(
        walletConfigResultAtom,
        AsyncResult.success({} as never)
      ),
      Atom.initialValue(
        walletConnectionStateAtom,
        scope ? connectedWallet : disconnectedWallet
      ),
      Atom.initialValue(walletScopeAtom, scope),
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

  it("stays idle when there is no wallet scope", () => {
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
    const registry = makeRegistry({
      getPositions,
      listActivity,
      scope: null,
    });
    const unmount = registry.mount(tabResourcesPrefetchAtom);

    try {
      expect(registry.get(tabResourcesPrefetchAtom)).toBe("idle");
      expect(getPositions).not.toHaveBeenCalled();
      expect(listActivity).not.toHaveBeenCalled();
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
