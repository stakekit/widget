import { useAtom, useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Data, Effect, Option, Schema, Stream } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import { appRuntime } from "../../../app/runtime";
import { EarnValidator } from "../../../domain/schema/earn-models";
import type {
  ValidatorAddress,
  YieldId,
} from "../../../domain/schema/identifiers";
import type { Network } from "../../../domain/schema/network-model";
import { filterValidators } from "../../../domain/types/yields";
import { YieldApiService } from "../../../services/api/yield-api-service";
import {
  getPullResultItems,
  paginatedApiStream,
} from "../../../shared/effect/pagination";
import { validatorsConfigAtom } from "./use-validators-config";

const PAGE_SIZE = 100;

class YieldValidatorsKey extends Data.Class<{
  readonly network: Network | null;
  readonly search: string | null;
  readonly yieldId: YieldId | null;
}> {}

class YieldValidatorsError extends Data.TaggedError("YieldValidatorsError")<{
  readonly cause: unknown;
}> {}

const yieldValidatorsHasNextPageAtom = Atom.family((_key: YieldValidatorsKey) =>
  Atom.make(false)
);

const makeValidatorsPullAtom = (key: YieldValidatorsKey) =>
  appRuntime.pull((context) => {
    if (!key.yieldId) {
      return Stream.empty;
    }

    const yieldId = key.yieldId;
    const validatorsConfig = context.get(validatorsConfigAtom);

    return paginatedApiStream({
      fetchPage: (offset) =>
        Effect.gen(function* () {
          const api = yield* YieldApiService;
          const fetchPage = (params: { name?: string; address?: string }) =>
            api.getValidators({
              ...params,
              limit: PAGE_SIZE,
              offset,
              status: "active",
              yieldId,
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
          const pages = responses;
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
                validatorsConfig,
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

const getYieldValidatorsPullAtom = Atom.family(makeValidatorsPullAtom);

type YieldValidatorsResult = {
  readonly data: EarnValidator[];
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
  readonly addresses: ReadonlyArray<ValidatorAddress>;
  readonly yieldId: YieldId;
}) =>
  Effect.gen(function* () {
    const api = yield* YieldApiService;

    return yield* Effect.forEach(
      addresses,
      (address) =>
        api
          .getValidators({
            address,
            limit: 100,
            offset: 0,
            yieldId,
          })
          .pipe(
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
  yieldId,
  network,
  search,
  enabled = true,
}: {
  enabled?: boolean;
  yieldId?: YieldId;
  network?: Network;
  search?: string;
}): YieldValidatorsResult => {
  const key = new YieldValidatorsKey({
    network: network ?? null,
    search: search?.trim() || null,
    yieldId: enabled ? (yieldId ?? null) : null,
  });
  const resource = getYieldValidatorsPullAtom(key);
  const [result, pull] = useAtom(resource);
  const refresh = useAtomRefresh(resource);
  const data: EarnValidator[] = [...getPullResultItems(result)];
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
