import { Effect, Layer, Option, Schema } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it } from "vitest";

import { Integration } from "../../../src/domain/borrow/integration";
import { EarnPosition } from "../../../src/domain/earn/balance";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { positionsViewAtom } from "../../../src/features/portfolio/state/read-models/positions";
import { yieldBalancesScanAtom } from "../../../src/features/portfolio/state/read-models/yield-balances";
import { retryPositionsAtom } from "../../../src/features/portfolio/state/retry-positions";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { borrowIntegrationsResourceAtom } from "../../../src/resources/borrow-integrations/borrow-integrations";
import { appRuntime } from "../../../src/runtime/app-runtime";
import {
  ApiRequestError,
  BorrowResourceSource,
  YieldResourceSource,
} from "../../../src/services/api/resource-sources";
import { yieldApiYieldFixture, yieldBalanceFixture } from "../../fixtures";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const stake = yieldApiYieldFixture();
const position = Schema.decodeSync(EarnPosition)({
  balances: [yieldBalanceFixture({ amount: "1", token: stake.token })],
  outputTokenBalance: null,
  yieldId: stake.id,
});
const scope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x9999999999999999999999999999999999999999"
  ),
  network: "ethereum",
});
const offline = new ApiRequestError({
  cause: new Error("offline"),
  failure: { _tag: "Unreachable" },
  operation: "positions",
});

type Response = "loaded" | "pending" | "failed";

/** The registry's positions source answers each request with `responses`. */
const makeRegistry = (responses: Array<Response>) =>
  AtomRegistry.make({
    initialValues: [
      applicationRuntimeInitInitialValue(),
      Atom.initialValue(walletScopeAtom, scope),
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          Layer.succeed(YieldResourceSource, {
            getPositions: () => {
              switch (responses.shift()) {
                case "pending":
                  return Effect.never;
                case "failed":
                  return Effect.fail(offline);
                default:
                  return Effect.succeed({ errors: [], items: [position] });
              }
            },
          } as never)
        ) as never
      ),
    ],
  });

describe("Portfolio positions view", () => {
  it("keeps the positions and reports refreshing while a refetch runs", () => {
    const registry = makeRegistry(["loaded", "pending"]);
    const unmount = registry.mount(positionsViewAtom);

    try {
      expect(registry.get(positionsViewAtom)).toMatchObject({
        _tag: "Ready",
        refreshing: false,
      });

      registry.set(yieldBalancesScanAtom, undefined);

      const view = registry.get(positionsViewAtom);
      expect(view).toMatchObject({ _tag: "Ready", refreshing: true });
      if (view._tag !== "Ready") throw new Error("expected Ready");
      expect(view.value.map((item) => item.integrationId)).toEqual([stake.id]);
      expect(Option.isNone(view.refreshFailure)).toBe(true);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("keeps the positions with the refresh failure when a refetch fails", () => {
    const registry = makeRegistry(["loaded", "failed"]);
    const unmount = registry.mount(positionsViewAtom);

    try {
      registry.set(yieldBalancesScanAtom, undefined);

      const view = registry.get(positionsViewAtom);
      expect(view).toMatchObject({ _tag: "Ready", refreshing: false });
      if (view._tag !== "Ready") throw new Error("expected Ready");
      expect(view.value.map((item) => item.integrationId)).toEqual([stake.id]);
      expect(Option.isSome(view.refreshFailure)).toBe(true);
    } finally {
      unmount();
      registry.dispose();
    }
  });

  it("shows the failure when the first load fails", () => {
    const registry = makeRegistry(["failed"]);
    const unmount = registry.mount(positionsViewAtom);

    try {
      expect(registry.get(positionsViewAtom)._tag).toBe("Failed");
    } finally {
      unmount();
      registry.dispose();
    }
  });
});

const integration = Schema.decodeSync(Integration)({
  id: "aave-borrow",
  name: "Aave V3",
  networks: ["ethereum"],
  metadata: {
    description: "Aave lending and borrowing",
    externalLink: "https://aave.com",
    logoURI: "https://assets.stakek.it/protocols/aave.svg",
  },
});

describe("retryPositionsAtom", () => {
  it("loads the Borrow integrations again after they failed", () => {
    let online = false;
    const borrowSource = BorrowResourceSource.of({
      getAction: () => Effect.succeedNone,
      getIntegrations: Effect.suspend(() =>
        online
          ? Effect.succeed([integration])
          : Effect.fail(
              new ApiRequestError({
                cause: new Error("borrow unavailable"),
                failure: { _tag: "Unreachable" },
                operation: "borrow-integrations",
              })
            )
      ),
      getMarkets: () =>
        Effect.succeed({ items: [], limit: 100, offset: 0, total: 0 }),
      getPositionData: () => Effect.succeed([]),
      listActions: () => Effect.die("unused"),
    });
    const registry = AtomRegistry.make({
      initialValues: [
        Atom.initialValue(
          appRuntime.layer,
          Layer.succeed(BorrowResourceSource, borrowSource)
        ),
        Atom.initialValue(walletScopeAtom, scope),
        applicationRuntimeInitInitialValue({
          apiKey: "api-key",
          borrowEnabled: true,
          dashboardVariant: true,
          variant: "default",
        }),
      ],
    });
    const unmount = registry.mount(borrowIntegrationsResourceAtom.local);

    try {
      expect(
        AsyncResult.isFailure(
          registry.get(borrowIntegrationsResourceAtom.local)
        )
      ).toBe(true);

      online = true;
      registry.set(retryPositionsAtom, undefined);

      expect(
        AsyncResult.getOrThrow(
          registry.get(borrowIntegrationsResourceAtom.local)
        )
      ).toEqual([integration]);
    } finally {
      unmount();
      registry.dispose();
    }
  });
});
