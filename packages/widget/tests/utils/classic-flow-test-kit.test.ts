import { describe, expect, it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Ref } from "effect";
import { ClassicTransactionFlowService } from "../../src/features/classic-transaction-flow/state/orchestration/classic-transaction-flow-service";
import { YieldOperations } from "../../src/services/api/operations";
import { WidgetNavigation } from "../../src/services/navigation/widget-navigation";
import { WalletService } from "../../src/services/wallet/wallet-service";
import type { WalletState } from "../../src/services/wallet/wallet-state";
import { yieldApiActionFixture } from "../fixtures";
import { makeDisconnectedWalletState } from "../fixtures/wallet-state";
import { makeClassicFlowTestKit } from "./classic-flow-test-kit";

const disconnectedWalletState: WalletState = makeDisconnectedWalletState();

describe("makeClassicFlowTestKit", () => {
  it.effect("provides a fresh Classic Flow layer and adapter controls", () =>
    Effect.gen(function* () {
      const kit = yield* makeClassicFlowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);
      const navigation = Context.get(context, WidgetNavigation);
      const wallet = Context.get(context, WalletService);

      expect(Context.get(context, ClassicTransactionFlowService)).toBeDefined();
      expect(yield* wallet.state).toEqual(disconnectedWalletState);

      yield* navigation.execute({ _tag: "Back" });

      expect(yield* kit.navigation.commands).toEqual([{ _tag: "Back" }]);
    })
  );

  it.effect("dies when an unconfigured Classic Flow dependency is called", () =>
    Effect.gen(function* () {
      const kit = yield* makeClassicFlowTestKit({
        initialWalletState: disconnectedWalletState,
      });
      const context = yield* Layer.build(kit.layer);
      const operations = Context.get(context, YieldOperations);
      const exit = yield* Effect.exit(operations.previewAction({} as never));

      expect(Exit.isFailure(exit)).toBe(true);
      expect(Exit.isFailure(exit) ? Cause.squash(exit.cause) : null).toBe(
        "makeClassicFlowTestKit: unexpected call to YieldOperations.previewAction"
      );
    })
  );

  it.effect("uses configured Classic Flow dependency behavior", () =>
    Effect.gen(function* () {
      const delegatedNavigationCount = yield* Ref.make(0);
      const preview = yieldApiActionFixture();
      const kit = yield* makeClassicFlowTestKit({
        initialWalletState: disconnectedWalletState,
        navigation: {
          execute: () =>
            Ref.update(delegatedNavigationCount, (count) => count + 1),
        },
        previewAction: () => Effect.succeed(preview),
      });
      const context = yield* Layer.build(kit.layer);

      yield* Context.get(context, WidgetNavigation).execute({ _tag: "Back" });
      const result = yield* Context.get(context, YieldOperations).previewAction(
        {} as never
      );

      expect(yield* Ref.get(delegatedNavigationCount)).toBe(1);
      expect(result).toBe(preview);
    })
  );
});
