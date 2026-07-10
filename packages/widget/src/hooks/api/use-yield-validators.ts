import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Data, Effect, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { valueEqualAtomFamily } from "../../atoms/api-resource";
import { getPullResultItems, paginatedApiStream } from "../../atoms/pagination";
import {
  EarnValidator,
  EarnValidatorPage,
} from "../../domain/schema/earn-models";
import { YieldId } from "../../domain/schema/identifiers";
import type { Network } from "../../domain/schema/wallet-models";
import type { Validator } from "../../domain/types/validators";
import {
  filterValidators,
  type ValidatorsConfig,
} from "../../domain/types/yields";
import { StakeKitApiService } from "../../providers/api/api-client";
import { stakeKitApiRuntime } from "../../providers/effect-atom-runtime/stakekit-api-service";
import { useValidatorsConfig } from "../use-validators-config";

const PAGE_SIZE = 100;

class YieldValidatorsKey extends Data.Class<{
  readonly enabled: boolean;
  readonly network: Network | null;
  readonly search: string | null;
  readonly validatorsConfig: ValidatorsConfig;
  readonly yieldId: YieldId | null;
}> {}

class YieldValidatorsError extends Data.TaggedError("YieldValidatorsError")<{
  readonly cause: unknown;
}> {}

const yieldValidatorsHasNextPageAtom = valueEqualAtomFamily(
  (_key: YieldValidatorsKey) => Atom.make(false)
);

const makeValidatorsPullAtom = (key: YieldValidatorsKey) =>
  stakeKitApiRuntime.pull((context) => {
    if (!key.enabled || !key.yieldId) {
      return Stream.empty;
    }

    const yieldId = key.yieldId;

    return paginatedApiStream({
      fetchPage: (offset) =>
        Effect.gen(function* () {
          const api = yield* StakeKitApiService;
          const fetchPage = (params: { name?: string; address?: string }) =>
            api.yield.YieldsControllerGetYieldValidators(yieldId, {
              params: {
                ...params,
                limit: PAGE_SIZE,
                offset,
                status: "active",
              },
            });
          const responses = key.search
            ? yield* Effect.all(
                [
                  fetchPage({ name: key.search }),
                  fetchPage({ address: key.search }),
                ],
                { concurrency: 2 }
              )
            : [yield* fetchPage({})];
          const pages = yield* Effect.forEach(responses, (response) =>
            Schema.decodeUnknownEffect(EarnValidatorPage)(response)
          );
          const seen = new Set<string>();
          const validators = pages
            .flatMap((page) => page.items ?? [])
            .filter((validator) => {
              if (seen.has(validator.key)) return false;
              seen.add(validator.key);
              return true;
            });
          const filtered = key.network
            ? filterValidators({
                network: key.network,
                validators,
                validatorsConfig: key.validatorsConfig,
                yieldId,
              })
            : validators;
          const total = Math.max(...pages.map((page) => page.total), 0);
          context.set(
            yieldValidatorsHasNextPageAtom(key),
            offset + PAGE_SIZE < total
          );

          return {
            items: filtered,
            limit: PAGE_SIZE,
            offset,
            total,
          };
        }).pipe(
          Effect.mapError((cause) => new YieldValidatorsError({ cause }))
        ),
    });
  });

const getYieldValidatorsPullAtom = valueEqualAtomFamily(makeValidatorsPullAtom);

type YieldValidatorsResult = {
  readonly data: Validator[];
  readonly error: unknown;
  readonly fetchNextPage: () => void;
  readonly hasNextPage: boolean;
  readonly isFetchingNextPage: boolean;
  readonly isLoading: boolean;
  readonly refetch: () => void;
};

export const getYieldValidatorsByAddressesEffect = ({
  addresses,
  yieldId,
}: {
  readonly addresses: ReadonlyArray<string>;
  readonly yieldId: YieldId;
}) =>
  Effect.gen(function* () {
    const api = yield* StakeKitApiService;

    return yield* Effect.forEach(
      addresses,
      (address) =>
        api.yield
          .YieldsControllerGetYieldValidators(yieldId, {
            params: { address, limit: 100, offset: 0 },
          })
          .pipe(
            Effect.flatMap((response) =>
              Schema.decodeUnknownEffect(EarnValidatorPage)(response)
            ),
            Effect.map((page) => {
              const normalizedAddress = address.toLowerCase();
              return (
                page.items?.find(
                  (validator) =>
                    validator.address.toLowerCase() === normalizedAddress
                ) ?? Schema.decodeUnknownSync(EarnValidator)({ address })
              );
            }),
            Effect.mapError((cause) => new YieldValidatorsError({ cause }))
          ),
      { concurrency: 5 }
    );
  });

export const useYieldValidators = ({
  yieldId: rawYieldId,
  network,
  search,
  enabled = true,
}: {
  enabled?: boolean;
  yieldId?: string;
  network?: Network;
  search?: string;
}): YieldValidatorsResult => {
  const validatorsConfig = useValidatorsConfig();
  const yieldId = rawYieldId
    ? Schema.decodeUnknownSync(YieldId)(rawYieldId)
    : null;
  const key = new YieldValidatorsKey({
    enabled: enabled && !!yieldId,
    network: network ?? null,
    search: search?.trim() || null,
    validatorsConfig,
    yieldId,
  });
  const resource = getYieldValidatorsPullAtom(key);
  const [result, pull] = useAtom(resource);
  const refresh = useAtomRefresh(resource);
  const data: Validator[] = [...getPullResultItems(result)];
  const hasNextPage = useAtomValue(yieldValidatorsHasNextPageAtom(key));

  return {
    data,
    error: result.pipe(AsyncResult.error, Option.getOrUndefined),
    fetchNextPage: () => pull(),
    hasNextPage,
    isFetchingNextPage: result.waiting && data.length > 0,
    isLoading: enabled && result.waiting && data.length === 0,
    refetch: refresh,
  } as const;
};
