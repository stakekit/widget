import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnValidator } from "../../../../../domain/earn/models";
import type { PullPage } from "../../../../../shared/effect/pagination";
import { yieldValidatorsAtom } from "../catalog/catalog";
import { YieldValidatorsPullKey } from "../catalog/keys";
import { earnSelectionViewAtom } from "./atoms";

const getPullPage = <A, E>(result: Atom.PullResult<PullPage<A>, E>) =>
  AsyncResult.getOrElse(result, () => null);

const getPullItems = <A, E>(
  result: Atom.PullResult<PullPage<A>, E>
): ReadonlyArray<A> =>
  getPullPage(result)?.items.flatMap((page) => page.items) ?? [];

type PageProjection = {
  readonly hasMore: boolean;
  readonly isLoadingFirstPage: boolean;
  readonly isLoadingMore: boolean;
};

const projectPage = <A, E>(
  result: Atom.PullResult<PullPage<A>, E>,
  items: ReadonlyArray<A>
): PageProjection => ({
  hasMore: getPullPage(result)?.done === false,
  isLoadingFirstPage: result.waiting && items.length === 0,
  isLoadingMore: result.waiting && items.length > 0,
});

const emptyPage: PageProjection = {
  hasMore: false,
  isLoadingFirstPage: false,
  isLoadingMore: false,
};

const pullNextPage = <A, E>(
  context: Atom.FnContext,
  atom: Atom.Writable<Atom.PullResult<PullPage<A>, E>, void>
) => {
  const result = context(atom);
  if (result.waiting || getPullPage(result)?.done !== false) return;
  context.set(atom, undefined);
};

type EarnValidatorsPage = PageProjection & {
  readonly items: ReadonlyArray<EarnValidator>;
};

export const earnValidatorsPageAtom = Atom.family((search: string | null) =>
  Atom.make<EarnValidatorsPage>((context) => {
    const validators = context.get(earnSelectionViewAtom).resources.validators;
    if (!validators.key) return { ...emptyPage, items: validators.items };

    const result = context.get(
      yieldValidatorsAtom(validators.key).validatorsPullAtom(
        new YieldValidatorsPullKey({ search })
      )
    );
    const pulled = getPullItems(result);

    return {
      ...projectPage(result, pulled),
      items: search ? pulled : validators.items,
    };
  }).pipe(Atom.withLabel("earnValidatorsPageAtom"))
);

export const loadMoreEarnValidatorsPageAtom = Atom.fnSync(
  (search: string | null, context) => {
    const validators = context(earnSelectionViewAtom).resources.validators;
    if (!validators.key) return;
    pullNextPage(
      context,
      yieldValidatorsAtom(validators.key).validatorsPullAtom(
        new YieldValidatorsPullKey({ search })
      )
    );
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreEarnValidatorsPageAtom"));
