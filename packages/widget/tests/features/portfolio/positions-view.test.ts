import { Effect, Layer, Option, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { describe, expect, it } from "vitest";
import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { EarnPosition } from "../../../src/domain/earn/models";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { positionsViewAtom } from "../../../src/features/portfolio/state/read-models/positions";
import { yieldBalancesScanAtom } from "../../../src/features/portfolio/state/read-models/yield-balances";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import {
  ApiRequestError,
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
