import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";

type PaginatedPage<Item> = {
  readonly items?: ReadonlyArray<Item> | null;
  readonly total?: number | null;
};

type SourcePaginatedPage<Item> = {
  readonly items: ReadonlyArray<Item>;
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
};

const getNextSourceOffset = ({
  limit,
  offset,
  total,
}: Omit<SourcePaginatedPage<never>, "items">): Option.Option<number> => {
  const nextOffset = offset + limit;

  return limit > 0 && nextOffset < total
    ? Option.some(nextOffset)
    : Option.none<number>();
};

/**
 * Pagination advances from the validated raw envelope metadata, never from the
 * number of domain items that survived tolerant top-level decoding.
 */
export const paginatedApiStream = <Item, E, R>({
  fetchPage,
  initialOffset = 0,
}: {
  readonly fetchPage: (
    offset: number
  ) => Effect.Effect<SourcePaginatedPage<Item>, E, R>;
  readonly initialOffset?: number;
}) =>
  Stream.paginate(initialOffset, (offset) =>
    fetchPage(offset).pipe(
      Effect.map((page) => [page.items, getNextSourceOffset(page)] as const)
    )
  );

export const loadAllPages = <Item, E, R>({
  concurrency,
  fetchPage,
  pageSize,
}: {
  readonly concurrency: number;
  readonly fetchPage: (
    offset: number
  ) => Effect.Effect<PaginatedPage<Item>, E, R>;
  readonly pageSize: number;
}): Effect.Effect<Array<Item>, E, R> =>
  Effect.gen(function* () {
    const firstPage = yield* fetchPage(0);
    const total = firstPage.total ?? 0;
    const remainingOffsets = Array.from(
      {
        length: Math.max(0, Math.ceil(total / pageSize) - 1),
      },
      (_, index) => (index + 1) * pageSize
    );
    const remainingItems = yield* Effect.forEach(remainingOffsets, fetchPage, {
      concurrency,
    }).pipe(Effect.map((pages) => pages.flatMap((page) => page.items ?? [])));

    return [...(firstPage.items ?? []), ...remainingItems];
  });

/**
 * AsyncResult.value falls back to the previous successful pull value, so a
 * failed next-page request does not erase already accumulated items.
 */
export const getPullResultItems = <Item, E>(
  result: Atom.PullResult<Item, E>
): ReadonlyArray<Item> =>
  result.pipe(
    AsyncResult.value,
    Option.map((value) => value.items as ReadonlyArray<Item>),
    Option.getOrElse(() => [])
  );
