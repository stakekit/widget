import { Data, Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime/app-runtime";
import type { YieldId } from "../../../domain/schema/identifiers";
import { isSupportedChain } from "../../../domain/types/chains";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
} from "../../../resources/yield-directory/yield-directory";
import { enrichedYieldOpportunityResourceAtom } from "../../../resources/yield-opportunity/yield-opportunity";
import { currentWalletConnectedNetworkAtom } from "../../wallet/state/selectors";

export class YieldOpportunityKey extends Data.Class<{
  readonly yieldId: YieldId | null;
}> {}

export const yieldOpportunityAtom = Atom.family((key: YieldOpportunityKey) =>
  appRuntime.atom((get) =>
    Effect.gen(function* () {
      if (!key.yieldId) return null;

      return yield* get.result(
        enrichedYieldOpportunityResourceAtom(key.yieldId)
      );
    })
  )
);

export class MultiYieldsKey extends Data.Class<{
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: { readonly yieldIds: ReadonlyArray<YieldId> }) {
    super({ yieldIds: [...new Set(input.yieldIds)].sort() });
  }
}

const multiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  enrichedYieldDirectoryResourceAtom(
    new YieldDirectoryKey({ yieldIds: key.yieldIds })
  ).pipe(
    Atom.mapResult((directory) =>
      key.yieldIds.length === 0 ? null : directory.items
    )
  )
);

export const visibleMultiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  Atom.make((get) => {
    const connectedNetwork = get(currentWalletConnectedNetworkAtom);

    return get(multiYieldsAtom(key)).pipe(
      AsyncResult.map(
        (yields) =>
          yields?.filter((yieldModel) => {
            const visible =
              yieldModel.id !== "binance-bnb-native-staking" &&
              yieldModel.id !== "binance-testnet-bnb-native-staking" &&
              yieldModel.id !== "avax-native-staking" &&
              yieldModel.status.enter &&
              isSupportedChain(yieldModel.token.network);

            return (
              visible &&
              (connectedNetwork === null ||
                connectedNetwork === yieldModel.token.network)
            );
          }) ?? null
      )
    );
  })
);

export const multiYieldsByIdAtom = Atom.family((key: MultiYieldsKey) =>
  multiYieldsAtom(key).pipe(
    Atom.mapResult(
      (yields) =>
        new Map((yields ?? []).map((yieldModel) => [yieldModel.id, yieldModel]))
    )
  )
);
