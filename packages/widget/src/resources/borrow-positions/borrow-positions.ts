import { Data, Duration, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import {
  type BorrowNetwork,
  isBorrowNetwork,
} from "../../domain/borrow/network";
import { deriveBorrowPositions } from "../../domain/borrow/positions/borrow-positions";
import type { BorrowIntegrationPositionsResponse } from "../../domain/borrow/responses";
import { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import {
  type WalletScopeKey,
  type WalletScopeOwnerKey,
  walletScopeOwnerKey,
} from "../../services/wallet/domain/scope";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import { withBorrowResourceError } from "../borrow/borrow-resource-error";
import { borrowIntegrationsResourceAtom } from "../borrow-integrations/borrow-integrations";
import {
  BorrowMarketsKey,
  borrowMarketsResourceAtom,
} from "../borrow-markets/borrow-markets";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

export class BorrowPositionsKey extends Data.TaggedClass("BorrowPositionsKey")<{
  readonly scope: WalletScopeOwnerKey | null;
}> {
  constructor(input: { readonly scope: WalletScopeKey | null }) {
    super({
      scope: input.scope ? walletScopeOwnerKey(input.scope) : null,
    });
  }
}

const borrowPositionPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

const borrowPositionDataResourceAtom = Atom.family((key: BorrowPositionsKey) =>
  appRuntime
    .atom((context) => {
      const network = key.scope?.network;
      if (!key.scope || !network || !isBorrowNetwork(network)) {
        return Effect.succeed(
          [] as typeof BorrowIntegrationPositionsResponse.Type
        );
      }
      const scope = key.scope;

      return Effect.gen(function* () {
        const allIntegrations = yield* context.result(
          borrowIntegrationsResourceAtom.local
        );
        const integrations = allIntegrations.filter((integration) =>
          integration.networks.includes(network)
        );
        const source = yield* BorrowResourceSource;
        return yield* source
          .getPositionData({
            address: scope.address,
            integrations,
            network: network as BorrowNetwork,
          })
          .pipe(
            Effect.catchTag("BorrowFeatureDisabled", () =>
              Effect.succeed(
                [] as typeof BorrowIntegrationPositionsResponse.Type
              )
            ),
            withBorrowResourceError("borrow-positions")
          );
      });
    })
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.borrowPositions(key.scope)),
      borrowPositionPolicy
    )
);

const borrowPositionsCanonicalAtom = Atom.family((key: BorrowPositionsKey) => {
  const network = key.scope?.network;
  if (!key.scope || !network || !isBorrowNetwork(network)) {
    return Atom.make(
      AsyncResult.success(
        deriveBorrowPositions({
          integrationAccountSnapshots: [],
          markets: [],
        })
      )
    );
  }
  const positionDataAtom = borrowPositionDataResourceAtom(key);
  const marketsAtom = borrowMarketsResourceAtom.local(
    new BorrowMarketsKey({ network })
  );

  return Atom.readable(
    (get) =>
      AsyncResult.all({
        integrationPositions: get(positionDataAtom),
        markets: get(marketsAtom),
      }).pipe(
        AsyncResult.map(({ integrationPositions, markets }) =>
          deriveBorrowPositions({
            integrationAccountSnapshots: integrationPositions.map(
              ({ integration, position }) => ({
                accountSnapshot: position,
                integration,
              })
            ),
            markets,
          })
        )
      ),
    (refresh) => {
      refresh(positionDataAtom);
      refresh(marketsAtom);
    }
  );
});

export const borrowPositionsResourceAtom = makePresentableResourceFamily(
  borrowPositionsCanonicalAtom
);
