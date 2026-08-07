import { Context, Effect, Layer, Option, Schema } from "effect";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import { ActivityActionsPage } from "../../domain/schema/activity-models";
import {
  type HistoryPeriod,
  KycStatus,
  RewardRateHistoryResponse,
  TvlHistoryResponse,
} from "../../domain/schema/dashboard-models";
import {
  EarnPositionsResponse,
  EarnProvider,
  EarnTokenPage,
  EarnValidatorPage,
  EarnYield,
  EarnYieldBalancesResponse,
  EarnYieldPage,
} from "../../domain/schema/earn-models";
import type { YieldBalancesCommand } from "../../domain/schema/financial-models";
import { HealthStatus } from "../../domain/schema/health-price-models";
import type {
  ProviderId,
  WalletAddress,
  YieldId,
} from "../../domain/schema/identifiers";
import type { ActivityActionsQuery } from "../../domain/schema/legacy-models";
import type { Network } from "../../domain/schema/network-model";
import type * as YieldApi from "../../generated/api/yield";
import {
  decodeApiResponse,
  withApiRequestError,
  withResponseDecodeError,
} from "./api-operation";
import { ApiTransportService } from "./transport";

export type YieldDirectoryRequest = {
  readonly limit: number;
  readonly network?: Network;
  readonly offset: number;
  readonly types?: ReadonlyArray<(typeof EarnYield.Type)["mechanics"]["type"]>;
  readonly yieldIds?: ReadonlyArray<YieldId>;
};

export type YieldTokenDirectoryRequest = {
  readonly limit: number;
  readonly networks?: ReadonlyArray<Network>;
  readonly offset: number;
  readonly yieldTypes?: ReadonlyArray<
    (typeof EarnYield.Type)["mechanics"]["type"]
  >;
};

export type ValidatorDirectoryRequest = {
  readonly address?: string;
  readonly limit: number;
  readonly name?: string;
  readonly offset: number;
  readonly preferred?: boolean;
  readonly status?: "active";
  readonly yieldId: YieldId;
};

const isNotFoundHttpClientError = (cause: unknown): boolean =>
  HttpClientError.isHttpClientError(cause) &&
  cause.reason._tag === "StatusCodeError" &&
  cause.reason.response.status === 404;

const toYieldDirectoryParams = (request: YieldDirectoryRequest) => ({
  limit: request.limit,
  ...(request.network ? { network: request.network } : {}),
  offset: request.offset,
  ...(request.types ? { types: [...request.types] } : {}),
  ...(request.yieldIds ? { yieldIds: [...request.yieldIds] } : {}),
});

export const makeYieldResourceSource = (yieldApi: YieldApi.YieldApi) => {
  const getHealth = Effect.fn("YieldResourceSource.getHealth")(function* () {
    return yield* yieldApi
      .HealthControllerHealth(undefined)
      .pipe(decodeApiResponse("yield-api-health", HealthStatus));
  });

  const getKycStatus = Effect.fn("YieldResourceSource.getKycStatus")(
    function* (request: {
      readonly address: WalletAddress;
      readonly yieldId: YieldId;
    }) {
      return yield* yieldApi
        .KycControllerGetStatus(request.yieldId, {
          params: { address: request.address },
        })
        .pipe(decodeApiResponse("yield-kyc-status", KycStatus));
    }
  );

  const getRewardRateHistory = Effect.fn(
    "YieldResourceSource.getRewardRateHistory"
  )(function* (request: {
    readonly interval: "day" | "week";
    readonly period: HistoryPeriod;
    readonly yieldId: YieldId;
  }) {
    return yield* yieldApi
      .YieldsControllerGetYieldRewardRateHistory(request.yieldId, {
        params: { interval: request.interval, period: request.period },
      })
      .pipe(
        decodeApiResponse(
          "yield-reward-rate-history",
          RewardRateHistoryResponse
        )
      );
  });

  const getTvlHistory = Effect.fn("YieldResourceSource.getTvlHistory")(
    function* (request: {
      readonly interval: "day" | "week";
      readonly period: HistoryPeriod;
      readonly yieldId: YieldId;
    }) {
      return yield* yieldApi
        .YieldsControllerGetYieldTvlHistory(request.yieldId, {
          params: { interval: request.interval, period: request.period },
        })
        .pipe(decodeApiResponse("yield-tvl-history", TvlHistoryResponse));
    }
  );

  const getSingleYieldBalances = Effect.fn(
    "YieldResourceSource.getSingleYieldBalances"
  )(function* (request: {
    readonly address: WalletAddress;
    readonly yieldId: YieldId;
  }) {
    return yield* yieldApi
      .YieldsControllerGetYieldBalances(request.yieldId, {
        payload: { address: request.address },
      })
      .pipe(
        decodeApiResponse("single-yield-balances", EarnYieldBalancesResponse)
      );
  });

  const listActivity = Effect.fn("YieldResourceSource.listActivity")(function* (
    query: ActivityActionsQuery
  ) {
    return yield* yieldApi
      .ActionsControllerGetActions({ params: query })
      .pipe(decodeApiResponse("activity-history", ActivityActionsPage));
  });

  const listYields = Effect.fn("YieldResourceSource.listYields")(function* (
    request: YieldDirectoryRequest
  ) {
    return yield* yieldApi
      .YieldsControllerGetYields({ params: toYieldDirectoryParams(request) })
      .pipe(decodeApiResponse("yield-directory", EarnYieldPage));
  });

  const listYieldTokens = Effect.fn("YieldResourceSource.listYieldTokens")(
    function* (request: YieldTokenDirectoryRequest) {
      return yield* yieldApi
        .TokensControllerGetTokens({
          params: {
            limit: request.limit,
            offset: request.offset,
            ...(request.networks ? { networks: [...request.networks] } : {}),
            ...(request.yieldTypes
              ? { yieldTypes: [...request.yieldTypes] }
              : {}),
          },
        })
        .pipe(decodeApiResponse("yield-token-directory", EarnTokenPage));
    }
  );

  const listValidators = Effect.fn("YieldResourceSource.listValidators")(
    function* (request: ValidatorDirectoryRequest) {
      return yield* yieldApi
        .YieldsControllerGetYieldValidators(request.yieldId, {
          params: {
            ...(request.address ? { address: request.address } : {}),
            limit: request.limit,
            ...(request.name ? { name: request.name } : {}),
            offset: request.offset,
            ...(request.preferred === undefined
              ? {}
              : { preferred: request.preferred }),
            ...(request.status ? { status: request.status } : {}),
          },
        })
        .pipe(decodeApiResponse("validator-directory", EarnValidatorPage));
    }
  );

  const getOpportunity = Effect.fn("YieldResourceSource.getOpportunity")(
    function* (yieldId: YieldId) {
      return yield* yieldApi
        .YieldsControllerGetYield(yieldId, undefined)
        .pipe(decodeApiResponse("yield-opportunity", EarnYield));
    }
  );

  const getPositions = Effect.fn("YieldResourceSource.getPositions")(function* (
    command: YieldBalancesCommand
  ) {
    return yield* yieldApi
      .YieldsControllerGetAggregateBalances({ payload: command })
      .pipe(decodeApiResponse("yield-positions", EarnPositionsResponse));
  });

  const getProvider = Effect.fn("YieldResourceSource.getProvider")(function* (
    providerId: ProviderId
  ) {
    const response = yield* yieldApi
      .ProvidersControllerGetProvider(providerId, undefined)
      .pipe(
        Effect.map(Option.some),
        Effect.catchIf(isNotFoundHttpClientError, () =>
          Effect.succeed(
            Option.none<YieldApi.ProvidersControllerGetProvider200>()
          )
        ),
        withApiRequestError("yield-provider")
      );

    return yield* response.pipe(
      Option.match({
        onNone: () => Effect.succeed(Option.none<typeof EarnProvider.Type>()),
        onSome: (value) =>
          Schema.decodeUnknownEffect(EarnProvider)(value).pipe(
            withResponseDecodeError("yield-provider"),
            Effect.map(Option.some)
          ),
      })
    );
  });

  return {
    getHealth,
    getKycStatus,
    getOpportunity,
    getPositions,
    getProvider,
    getSingleYieldBalances,
    getRewardRateHistory,
    getTvlHistory,
    listYields,
    listYieldTokens,
    listValidators,
    listActivity,
  } as const;
};

export class YieldResourceSource extends Context.Service<YieldResourceSource>()(
  "stakekit/widget/services/api/YieldResourceSource",
  {
    make: Effect.map(ApiTransportService, ({ resources }) =>
      makeYieldResourceSource(resources.yield)
    ),
  }
) {
  static readonly layer = Layer.effect(
    YieldResourceSource,
    YieldResourceSource.make
  );
}
