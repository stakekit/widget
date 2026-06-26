import { Effect } from "effect";

type PaginatedPage<Item> = {
  items?: ReadonlyArray<Item> | null;
  total?: number | null;
};

type LoadAllPagesParams<Item, E, R> = {
  concurrency: number;
  fetchPage: (offset: number) => Effect.Effect<PaginatedPage<Item>, E, R>;
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
