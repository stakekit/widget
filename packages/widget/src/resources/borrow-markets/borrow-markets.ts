import { Data, Duration } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { BorrowNetwork } from "../../domain/borrow/network";
import { BorrowResourceSource } from "../../services/api/borrow-resource-source";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPages,
} from "../../shared/effect/pagination";
import { withBorrowResourceError } from "../borrow/borrow-resource-error";

const CONCURRENCY = 5;

export class BorrowMarketsKey extends Data.TaggedClass("BorrowMarketsKey")<{
  readonly network: BorrowNetwork;
}> {}

const borrowMarketPolicy = withApiResourcePolicy({
  idleTTL: Duration.minutes(5),
  staleTime: Duration.minutes(1),
  revalidateOnMount: true,
});

export const borrowMarketsResourceAtom = Atom.family((key: BorrowMarketsKey) =>
  appRuntime
    .atom(
      BorrowResourceSource.use((source) =>
        loadAllPages({
          concurrency: CONCURRENCY,
          fetchPage: (offset) =>
            source.getMarkets({
              limit: API_MAX_PAGE_SIZE,
              network: key.network,
              offset,
              scope: "all",
            }),
          pageSize: API_MAX_PAGE_SIZE,
        }).pipe(withBorrowResourceError("borrow-markets"))
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.borrowMarkets(key.network)),
      borrowMarketPolicy
    )
);
