import { Match } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { EarnValidator } from "../../../../../domain/earn/models";
import type { PullPage } from "../../../../../shared/effect/pagination";
import {
  availableYieldCategoriesAtom,
  earnYieldCatalogAtom,
  initYieldAtom,
  mergedTokenOptionsAtom,
  positionsDataAtom,
  tokenOptionsPullAtom,
  yieldValidatorsAtom,
} from "../catalog/catalog";
import { YieldValidatorsPullKey } from "../catalog/keys";
import type { EarnRetryTarget } from "../types";
import { earnMachineViewAtom } from "./atoms";

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

export const earnTokenOptionsPageAtom = Atom.make<PageProjection>((context) => {
  const pullKey =
    context.get(earnMachineViewAtom).resources.tokenOptions.pullKey;
  if (!pullKey) return emptyPage;

  const result = context.get(tokenOptionsPullAtom(pullKey));

  return projectPage(result, getPullItems(result));
}).pipe(Atom.withLabel("earnTokenOptionsPageAtom"));

export const loadMoreEarnTokenOptionsAtom = Atom.fnSync(
  (_input: undefined, context) => {
    const pullKey = context(earnMachineViewAtom).resources.tokenOptions.pullKey;
    if (!pullKey) return;
    pullNextPage(context, tokenOptionsPullAtom(pullKey));
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("loadMoreEarnTokenOptionsAtom"));

type EarnValidatorsPage = PageProjection & {
  readonly items: ReadonlyArray<EarnValidator>;
};

export const earnValidatorsPageAtom = Atom.family((search: string | null) =>
  Atom.make<EarnValidatorsPage>((context) => {
    const validators = context.get(earnMachineViewAtom).resources.validators;
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
    const validators = context(earnMachineViewAtom).resources.validators;
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

const refreshEarnRetryTarget = (
  context: Atom.FnContext,
  target: EarnRetryTarget
): void =>
  Match.value(target).pipe(
    Match.tag("AvailableCategories", ({ key }) =>
      context.refresh(availableYieldCategoriesAtom(key))
    ),
    Match.tag("InitYield", ({ key }) => context.refresh(initYieldAtom(key))),
    Match.tag("PositionsData", ({ key }) =>
      context.refresh(positionsDataAtom(key))
    ),
    Match.tag("TokenOptions", ({ key }) =>
      context.refresh(mergedTokenOptionsAtom(key))
    ),
    Match.tag("YieldCatalog", ({ key }) =>
      context.refresh(earnYieldCatalogAtom(key))
    ),
    Match.tag("YieldValidators", ({ key }) =>
      context.refresh(yieldValidatorsAtom(key).initialValidatorsResultAtom)
    ),
    Match.exhaustive
  );

export const retryEarnMachineAtom = Atom.fnSync(
  (_input: undefined, context) => {
    const target = context(earnMachineViewAtom).retryTarget;
    if (target) refreshEarnRetryTarget(context, target);
  },
  { initialValue: undefined }
).pipe(Atom.withLabel("retryEarnMachineAtom"));
