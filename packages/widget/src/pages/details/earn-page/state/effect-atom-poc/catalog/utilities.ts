import { Effect } from "effect";
import { chunksOf } from "effect/Array";

type PaginatedPage<Item> = {
  items?: ReadonlyArray<Item> | null;
  total?: number | null;
};

type LoadAllPagesParams<Item, E, R> = {
  concurrency: number;
  fetchPage: (offset: number) => Effect.Effect<PaginatedPage<Item>, E, R>;
  pageSize: number;
};

type LoadAllPagesByIdChunksParams<Id, Item, E, R> = {
  chunkSize: number;
  concurrency: number;
  fetchPage: (params: {
    ids: ReadonlyArray<Id>;
    offset: number;
  }) => Effect.Effect<PaginatedPage<Item>, E, R>;
  getItemId: (item: Item) => Id;
  ids: ReadonlyArray<Id>;
  pageSize: number;
};

export const loadAllPages = <Item, E, R>({
  concurrency,
  fetchPage,
  pageSize,
}: LoadAllPagesParams<Item, E, R>): Effect.Effect<Array<Item>, E, R> =>
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

const unique = <T>(items: ReadonlyArray<T>) => [...new Set(items)];

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
    const uniqueIds = unique(ids);

    if (uniqueIds.length === 0) {
      return [];
    }

    const normalizedChunkSize = Math.max(1, chunkSize);
    const pagesByChunk = yield* Effect.forEach(
      chunksOf(uniqueIds, normalizedChunkSize),
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

      if (!itemsById.has(id)) {
        itemsById.set(id, item);
      }
    }

    return uniqueIds.flatMap((id) => {
      const item = itemsById.get(id);

      return item ? [item] : [];
    });
  });
