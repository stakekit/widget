import { Data } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
} from "../../../resources/yield-directory/yield-directory";
import { isSupportedChain } from "../../../services/wallet/supported-chains";
import { walletConnectedNetworkAtom } from "../../wallet/state";

export class MultiYieldsKey extends Data.Class<{
  readonly yieldIds: ReadonlyArray<YieldId>;
}> {
  constructor(input: { readonly yieldIds: ReadonlyArray<YieldId> }) {
    super({ yieldIds: [...new Set(input.yieldIds)].sort() });
  }
}

const multiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  enrichedYieldDirectoryResourceAtom
    .foreground(new YieldDirectoryKey({ yieldIds: key.yieldIds }))
    .pipe(
      Atom.mapResult((directory) =>
        key.yieldIds.length === 0 ? null : directory.items
      )
    )
);

export const visibleMultiYieldsAtom = Atom.family((key: MultiYieldsKey) =>
  Atom.make((get) => {
    const connectedNetwork = get(walletConnectedNetworkAtom);

    return get(multiYieldsAtom(key)).pipe(
      AsyncResult.map(
        (yields) =>
          yields?.filter((yieldModel) => {
            const visible =
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
