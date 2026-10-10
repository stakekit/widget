import { Data } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type { YieldId } from "../../../domain/identity/identifiers";
import {
  enrichedYieldDirectoryResourceAtom,
  YieldDirectoryKey,
} from "../../../resources/yield-directory/index";

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

export const multiYieldsByIdAtom = Atom.family((key: MultiYieldsKey) =>
  multiYieldsAtom(key).pipe(
    Atom.mapResult(
      (yields) =>
        new Map((yields ?? []).map((yieldModel) => [yieldModel.id, yieldModel]))
    )
  )
);
