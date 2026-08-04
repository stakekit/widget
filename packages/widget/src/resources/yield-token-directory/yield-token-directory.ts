import { Data, Duration, Effect, Stream } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../app/runtime/app-runtime";
import type {
  ApiRequestError,
  ResponseDecodeError,
} from "../../domain/schema/api-errors";
import type { EarnTokenPage, EarnYield } from "../../domain/schema/earn-models";
import type { Network } from "../../domain/schema/network-model";
import { YieldResourceSource } from "../../services/api/yield-resource-source";
import { withApiResourcePolicy } from "../../shared/effect/api-resource";
import {
  API_MAX_PAGE_SIZE,
  type PullPage,
  paginatedApiStream,
  withPullPageDone,
} from "../../shared/effect/pagination";
import { makePresentableResourceFamily } from "../resource-failure-presentation";

type YieldType = (typeof EarnYield.Type)["mechanics"]["type"];
type YieldToken = NonNullable<(typeof EarnTokenPage.Type)["items"]>[number];

export class YieldTokensKey extends Data.TaggedClass("YieldTokensKey")<{
  readonly networks: ReadonlyArray<Network> | null;
  readonly yieldTypes: ReadonlyArray<YieldType> | null;
}> {
  constructor(input?: {
    readonly networks?: ReadonlyArray<Network> | null;
    readonly yieldTypes?: ReadonlyArray<YieldType> | null;
  }) {
    super({
      networks:
        input?.networks === undefined || input.networks === null
          ? null
          : [...new Set(input.networks)].sort(),
      yieldTypes:
        input?.yieldTypes === undefined || input.yieldTypes === null
          ? null
          : [...new Set(input.yieldTypes)].sort(),
    });
  }
}

export class YieldTokensError extends Data.TaggedError("YieldTokensError")<{
  readonly cause: ApiRequestError | ResponseDecodeError;
}> {}

const yieldTokensPolicy = withApiResourcePolicy({
  staleTime: Duration.minutes(5),
});

const emptyYieldTokensPullAtom = Atom.pull<
  PullPage<YieldToken>,
  YieldTokensError
>(
  Stream.succeed({
    hasNextPage: false,
    items: [],
  })
).pipe(withPullPageDone);

const yieldTokensCanonicalPullAtom = Atom.family((key: YieldTokensKey) => {
  if (key.networks?.length === 0 || key.yieldTypes?.length === 0) {
    return emptyYieldTokensPullAtom;
  }

  return appRuntime
    .pull(() =>
      paginatedApiStream<
        YieldToken,
        ApiRequestError | ResponseDecodeError,
        YieldResourceSource
      >({
        fetchPage: (offset) =>
          YieldResourceSource.use((source) =>
            source
              .listYieldTokens({
                limit: API_MAX_PAGE_SIZE,
                offset,
                ...(key.networks ? { networks: key.networks } : {}),
                ...(key.yieldTypes ? { yieldTypes: key.yieldTypes } : {}),
              })
              .pipe(
                Effect.map((page) => ({ ...page, items: page.items ?? [] }))
              )
          ),
      }).pipe(Stream.mapError((cause) => new YieldTokensError({ cause })))
    )
    .pipe(
      withPullPageDone,
      yieldTokensPolicy,
      Atom.withLabel("yieldTokensPullAtom")
    );
});

export const yieldTokensPullAtom = makePresentableResourceFamily(
  yieldTokensCanonicalPullAtom
);
