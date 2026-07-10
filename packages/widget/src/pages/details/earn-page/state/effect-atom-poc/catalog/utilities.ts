import { Effect } from "effect";
import { chunksOf } from "effect/Array";
import { loadAllPages } from "../../../../../../atoms/pagination";

type PaginatedPage<Item> = {
  items?: ReadonlyArray<Item> | null;
  total?: number | null;
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

export { loadAllPages };

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
