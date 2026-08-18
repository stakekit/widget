import { Data, Duration, Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type { BorrowNetwork } from "../../domain/borrow/network";
import { BorrowResourceSource } from "../../services/api/resource-sources";
import { resourceInvalidationKeys } from "../../services/resource-invalidation";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  loadAllPages,
} from "../../shared/effect/pagination";
import { withBorrowResourceError } from "../borrow/index";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

const CONCURRENCY = 5;

export class BorrowMarketsKey extends Data.TaggedClass("BorrowMarketsKey")<{
  readonly network: BorrowNetwork;
}> {}

const borrowMarketPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(1),
});

const borrowMarketsCanonicalAtom = Atom.family((key: BorrowMarketsKey) =>
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
        }).pipe(
          Effect.catchTag("BorrowFeatureDisabled", () => Effect.succeed([])),
          withBorrowResourceError("borrow-markets")
        )
      )
    )
    .pipe(
      Atom.withReactivity(resourceInvalidationKeys.borrowMarkets(key.network)),
      borrowMarketPolicy
    )
);

export const borrowMarketsResourceAtom = makePresentableResourceFamily(
  borrowMarketsCanonicalAtom
);
