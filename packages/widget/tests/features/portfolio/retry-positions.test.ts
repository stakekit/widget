import { Effect, Layer, Schema } from "effect";
import { AsyncResult, Atom, AtomRegistry } from "effect/reactivity";
import { describe, expect, it } from "vitest";

import { appRuntime } from "../../../src/app/runtime/app-runtime";
import { Integration } from "../../../src/domain/borrow/catalog/integration";
import { WalletAddress } from "../../../src/domain/identity/identifiers";
import { WalletScopeKey } from "../../../src/domain/wallet/wallet-scope";
import { retryPositionsAtom } from "../../../src/features/portfolio/state/retry-positions";
import { walletScopeAtom } from "../../../src/features/wallet/index";
import { borrowIntegrationsResourceAtom } from "../../../src/resources/borrow-integrations/index";
import {
  ApiRequestError,
  BorrowResourceSource,
} from "../../../src/services/api/resource-sources";
import { applicationRuntimeInitInitialValue } from "../../utils/widget-config";

const walletScope = new WalletScopeKey({
  address: Schema.decodeSync(WalletAddress)(
    "0x0000000000000000000000000000000000000001"
  ),
  network: "ethereum",
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
        Atom.initialValue(walletScopeAtom, walletScope),
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
