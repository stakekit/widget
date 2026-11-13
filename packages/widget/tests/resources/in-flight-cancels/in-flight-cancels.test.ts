import { describe, expect, it, vi } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import * as Reactivity from "effect/reactivity/Reactivity";

import type { ActivityActionsPage } from "../../../src/domain/activity/models";
import type { ActivityActionsQuery } from "../../../src/domain/activity/query";
import type { YieldAction } from "../../../src/domain/earn/action-models";
import {
  WalletAddress,
  YieldId,
} from "../../../src/domain/identity/identifiers";
import { WalletScopeOwnerKey } from "../../../src/domain/wallet/wallet-scope";
import {
  InFlightCancelsKey,
  inFlightCancelsResourceAtom,
} from "../../../src/resources/in-flight-cancels/in-flight-cancels";
import { appRuntime } from "../../../src/runtime/app-runtime";
import { resourceInvalidationKeys } from "../../../src/services/resource-invalidation";
import { yieldApiActionFixture } from "../../fixtures";
import { readCountsAcrossHiddenPage } from "../../utils/services/page-visibility";
import { yieldResourceSourceLayer } from "../../utils/services/resource-sources";

const owner = new WalletScopeOwnerKey({
  address: WalletAddress.make("0x00000000000000000000000000000000000000a1"),
  network: "ethereum-sepolia",
});
const yieldId = YieldId.make("ethereum-sepolia-usdc-zama-confidential-vault");
const key = new InFlightCancelsKey({ scope: owner, yieldId });

const firstHandle = `0x${"a1".repeat(32)}`;
const secondHandle = `0x${"b2".repeat(32)}`;

const cancel = (
  encryptedAmount: string | undefined,
  status: "PROCESSING" | "SUCCESS" = "PROCESSING"
): YieldAction =>
  yieldApiActionFixture({
    ...(encryptedAmount === undefined ? {} : { encryptedAmount }),
    status,
    type: "CANCEL_PENDING",
    yieldId,
  });

const page = (items: ReadonlyArray<YieldAction>): ActivityActionsPage => ({
  items: [...items],
  limit: 20,
  offset: 0,
  total: items.length,
});

const reactivityAtom = appRuntime.atom(Reactivity.Reactivity);

const makeRegistry = (
  listActivity: (
    query: ActivityActionsQuery
  ) => Effect.Effect<ActivityActionsPage>,
  initialValues: ReadonlyArray<readonly [Atom.Atom<unknown>, unknown]> = []
) =>
  AtomRegistry.make({
    initialValues: [
      Atom.initialValue(
        appRuntime.layer,
        Layer.mergeAll(
          Reactivity.layer,
          yieldResourceSourceLayer({ listActivity })
        ) as never
      ),
      ...initialValues,
    ],
  });

describe("In-flight Cancels resource", () => {
  it("looks up the yield's first 20 processing cancels and reports their encrypted amounts", () => {
    const listActivity = vi.fn((_query: ActivityActionsQuery) =>
      Effect.succeed(
        page([
          cancel(firstHandle.toUpperCase().replace("0X", "0x")),
          cancel(undefined),
          cancel(secondHandle, "SUCCESS"),
        ])
      )
    );
    const registry = makeRegistry(listActivity);
    const resource = inFlightCancelsResourceAtom(key);
    registry.mount(resource);

    const handles = AsyncResult.getOrThrow(registry.get(resource));
    registry.dispose();

    expect(listActivity).toHaveBeenCalledExactlyOnceWith({
      address: "0x00000000000000000000000000000000000000a1",
      limit: 20,
      offset: 0,
      statuses: ["PROCESSING"],
      type: "CANCEL_PENDING",
      yieldId: "ethereum-sepolia-usdc-zama-confidential-vault",
    });
    expect([...handles]).toEqual([firstHandle]);
  });

  it.effect(
    "reads again when the owner's positions are invalidated, dropping a confirmed cancel",
    () =>
      Effect.gen(function* () {
        const responses = [
          page([cancel(firstHandle), cancel(secondHandle)]),
          page([cancel(secondHandle)]),
        ];
        const listActivity = vi.fn((_query: ActivityActionsQuery) =>
          Effect.succeed(responses[listActivity.mock.calls.length - 1]!)
        );
        const registry = makeRegistry(listActivity);
        yield* Effect.addFinalizer(() => Effect.sync(() => registry.dispose()));
        const resource = inFlightCancelsResourceAtom(key);
        registry.mount(resource);
        registry.mount(reactivityAtom);
        expect([...AsyncResult.getOrThrow(registry.get(resource))]).toEqual([
          firstHandle,
          secondHandle,
        ]);

        const reactivity = AsyncResult.getOrThrow(registry.get(reactivityAtom));
        yield* reactivity.invalidate(
          resourceInvalidationKeys.yieldPositions(
            new WalletScopeOwnerKey({
              address: WalletAddress.make(
                "0x00000000000000000000000000000000000000b2"
              ),
              network: "ethereum-sepolia",
            })
          )
        );
        expect(listActivity).toHaveBeenCalledTimes(1);

        yield* reactivity.invalidate(
          resourceInvalidationKeys.yieldPositions(owner)
        );
        expect(listActivity).toHaveBeenCalledTimes(2);
        expect([...AsyncResult.getOrThrow(registry.get(resource))]).toEqual([
          secondHandle,
        ]);
      })
  );

  it.effect(
    "skips scheduled lookups while the page is hidden and looks up once when it is shown",
    () => {
      const listActivity = vi.fn((_query: ActivityActionsQuery) =>
        Effect.succeed(page([]))
      );
      return readCountsAcrossHiddenPage({
        mount: (pageVisibility) => {
          const registry = makeRegistry(listActivity, [pageVisibility]);
          registry.mount(inFlightCancelsResourceAtom(key));
          return registry;
        },
        periodSeconds: 60,
        readCount: () => listActivity.mock.calls.length,
      }).pipe(
        Effect.map((readCounts) => {
          expect(readCounts).toEqual([1, 2, 2, 3, 3, 4]);
        })
      );
    }
  );
});
