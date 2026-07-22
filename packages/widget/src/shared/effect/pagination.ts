import { Array as EArray, Effect, Option, Stream } from "effect";
import { chunksOf } from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

type PaginatedPage<Item> = {
  readonly items?: ReadonlyArray<Item> | null;
  readonly limit?: number | null;
  readonly offset?: number | null;
  readonly total?: number | null;
};

export type PullPage<Item> = {
  readonly hasNextPage: boolean;
  readonly items: ReadonlyArray<Item>;
};

type PullBatch = {
  readonly hasNextPage: boolean;
};

type PaginationMetadata = {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
};

type PaginatedStreamPage<Item> = PaginationMetadata & {
  readonly items: ReadonlyArray<Item>;
};

export const API_MAX_PAGE_SIZE = 100;

export const getNextPageOffset = ({
  limit,
  offset,
  total,
}: PaginationMetadata): Option.Option<number> => {
  const nextOffset = offset + limit;

  return limit > 0 && nextOffset < total
    ? Option.some(nextOffset)
    : Option.none<number>();
};

/**
 * Pagination advances from the validated raw envelope metadata, never from the
 * number of domain items that survived tolerant top-level decoding.
 */
type PaginatedApiStreamOptions<Item, E, R> = {
  readonly fetchPage: (
    offset: number
  ) => Effect.Effect<PaginatedStreamPage<Item>, E, R>;
  readonly initialOffset?: number;
};

export function paginatedApiStream<Item, E, R>(
  options: PaginatedApiStreamOptions<Item, E, R>
): Stream.Stream<PullPage<Item>, E, R>;
export function paginatedApiStream<Item, E, R, Batch extends PullBatch>(
  options: PaginatedApiStreamOptions<Item, E, R> & {
    readonly mapPage: (
      page: PaginatedStreamPage<Item>,
      hasNextPage: boolean
    ) => Batch;
  }
): Stream.Stream<Batch, E, R>;
export function paginatedApiStream<Item, E, R, Batch extends PullBatch>({
  fetchPage,
  initialOffset = 0,
  mapPage,
}: PaginatedApiStreamOptions<Item, E, R> & {
  readonly mapPage?: (
    page: PaginatedStreamPage<Item>,
    hasNextPage: boolean
  ) => Batch;
}): Stream.Stream<PullPage<Item> | Batch, E, R> {
  return Stream.paginate(initialOffset, (offset) =>
    fetchPage(offset).pipe(
      Effect.map((page) => {
        const nextOffset = getNextPageOffset(page);
        const hasNextPage = Option.isSome(nextOffset);

        return [
          [
            mapPage
              ? mapPage(page, hasNextPage)
              : { hasNextPage, items: page.items },
          ],
          nextOffset,
        ] as const;
      })
    )
  );
}

export const withPullPageDone = <Page extends PullBatch, E>(
  resource: Atom.Writable<Atom.PullResult<Page, E>, void>
): Atom.Writable<Atom.PullResult<Page, E>, void> =>
  Atom.transform<
    Atom.Writable<Atom.PullResult<Page, E>, void>,
    Atom.PullResult<Page, E>
  >(resource, (get) =>
    get(resource).pipe(
      AsyncResult.map(({ items }) => ({
        done: !EArray.lastNonEmpty(items).hasNextPage,
        items,
      }))
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
    const effectivePageSize =
      firstPage.limit && firstPage.limit > 0 ? firstPage.limit : pageSize;
    const nextOffset = (firstPage.offset ?? 0) + effectivePageSize;
    const remainingOffsets = Array.from(
      {
        length: Math.max(
          0,
          Math.ceil((total - nextOffset) / effectivePageSize)
        ),
      },
      (_, index) => nextOffset + index * effectivePageSize
    );
    const remainingItems = yield* Effect.forEach(remainingOffsets, fetchPage, {
      concurrency,
    }).pipe(Effect.map((pages) => pages.flatMap((page) => page.items ?? [])));

    return [...(firstPage.items ?? []), ...remainingItems];
  });

type LoadAllPagesByIdChunksParams<Id, Item, E, R> = {
  readonly chunkSize: number;
  readonly concurrency: number;
  readonly fetchPage: (params: {
    readonly ids: ReadonlyArray<Id>;
    readonly offset: number;
  }) => Effect.Effect<PaginatedPage<Item>, E, R>;
  readonly getItemId: (item: Item) => Id;
  readonly ids: ReadonlyArray<Id>;
  readonly pageSize: number;
};

export const loadAllPagesByIdChunks = <Id, Item, E, R>({
  chunkSize,
  concurrency,
  fetchPage,
  getItemId,
  ids,
  pageSize,
}: LoadAllPagesByIdChunksParams<Id, Item, E, R>): Effect.Effect<
  Array<Item>,
  E,
  R
> =>
  Effect.gen(function* () {
    const uniqueIds = [...new Set(ids)];

    if (uniqueIds.length === 0) return [];

    const pagesByChunk = yield* Effect.forEach(
      chunksOf(uniqueIds, Math.max(1, chunkSize)),
      (chunk) =>
        loadAllPages({
          concurrency,
          fetchPage: (offset) => fetchPage({ ids: chunk, offset }),
          pageSize,
        }),
      { concurrency }
    );
    const itemsById = new Map<Id, Item>();

    for (const item of pagesByChunk.flat()) {
      const id = getItemId(item);
      if (!itemsById.has(id)) itemsById.set(id, item);
    }

    return uniqueIds.flatMap((id) => {
      const item = itemsById.get(id);
      return item ? [item] : [];
    });
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
    Option.getOrElse((): ReadonlyArray<Item> => [])
  );
