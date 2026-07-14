import { Effect } from "effect";
import {
  ActionCommand,
  ActionTransaction,
  ManageActionCommand,
  type SubmitSignedTransactionCommand,
  type SubmitTransactionHashCommand,
  type TransactionStatusCommand,
  YieldAction,
} from "../../domain/schema/action-models";
import { ActivityActionsPage } from "../../domain/schema/activity-models";
import {
  type HistoryPeriod,
  KycStatus,
  RewardRateHistoryResponse,
  TvlHistoryResponse,
} from "../../domain/schema/dashboard-models";
import {
  AvailableYieldCategoriesPage,
  EarnPositionsResponse,
  EarnProvider,
  EarnTokenPage,
  EarnValidatorPage,
  EarnYield,
  EarnYieldBalancesResponse,
  EarnYieldPage,
  TokenYieldScopePage,
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
import { decodeApiResponse, encodeApiRequest } from "./api-operation";

export type ActionPreviewRequest =
  | {
      readonly intent: "enter" | "exit";
      readonly command: ActionCommand;
    }
  | {
      readonly intent: "manage";
      readonly command: ManageActionCommand;
    };

type YieldsRequest = {
  readonly limit: number;
  readonly network?: Network;
  readonly offset?: number;
  readonly types?: ReadonlyArray<(typeof EarnYield.Type)["mechanics"]["type"]>;
  readonly yieldIds?: ReadonlyArray<YieldId>;
};

type YieldTokensRequest = {
  readonly limit: number;
  readonly networks?: ReadonlyArray<Network>;
  readonly offset: number;
  readonly yieldTypes?: ReadonlyArray<
    (typeof EarnYield.Type)["mechanics"]["type"]
  >;
};

type YieldValidatorsRequest = {
  readonly address?: string;
  readonly limit: number;
  readonly name?: string;
  readonly offset: number;
  readonly preferred?: boolean;
  readonly status?: "active";
  readonly yieldId: YieldId;
};

const toYieldsParams = (request: YieldsRequest) => ({
  limit: request.limit,
  ...(request.network ? { network: request.network } : {}),
  ...(request.offset === undefined ? {} : { offset: request.offset }),
  ...(request.types ? { types: [...request.types] } : {}),
  ...(request.yieldIds ? { yieldIds: [...request.yieldIds] } : {}),
});

export const makeYieldApiService = (yieldApi: YieldApi.YieldApi) => {
  const previewAction = Effect.fn("StakeKitApiService.yield.previewAction")(
    function* (request: ActionPreviewRequest) {
      switch (request.intent) {
        case "enter": {
          const payload = yield* encodeApiRequest(
            "action-enter-request",
            ActionCommand
          )(request.command);
          return yield* yieldApi
            .ActionsControllerEnterYield({ payload })
            .pipe(decodeApiResponse("action-enter-preview", YieldAction));
        }
        case "exit": {
          const payload = yield* encodeApiRequest(
            "action-exit-request",
            ActionCommand
          )(request.command);
          return yield* yieldApi
            .ActionsControllerExitYield({ payload })
            .pipe(decodeApiResponse("action-exit-preview", YieldAction));
        }
        case "manage": {
          const payload = yield* encodeApiRequest(
            "action-manage-request",
            ManageActionCommand
          )(request.command);
          return yield* yieldApi
            .ActionsControllerManageYield({ payload })
            .pipe(decodeApiResponse("action-manage-preview", YieldAction));
        }
      }
    }
  );

  const getTransactionStatus = Effect.fn(
    "StakeKitApiService.yield.getTransactionStatus"
  )(function* (command: TransactionStatusCommand) {
    return yield* yieldApi
      .TransactionsControllerGetTransaction(command.transactionId, undefined)
      .pipe(decodeApiResponse("get-transaction-status", ActionTransaction));
  });

  const submitTransactionHash = Effect.fn(
    "StakeKitApiService.yield.submitTransactionHash"
  )(function* (command: SubmitTransactionHashCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransactionHash(command.transactionId, {
        payload: command.payload,
      })
      .pipe(decodeApiResponse("submit-transaction-hash", ActionTransaction));
  });

  const submitSignedTransaction = Effect.fn(
    "StakeKitApiService.yield.submitSignedTransaction"
  )(function* (command: SubmitSignedTransactionCommand) {
    return yield* yieldApi
      .TransactionsControllerSubmitTransaction(command.transactionId, {
        payload: command.payload,
      })
      .pipe(decodeApiResponse("submit-signed-transaction", ActionTransaction));
  });

  const getYieldPositions = Effect.fn(
    "StakeKitApiService.yield.getYieldPositions"
  )(function* (command: YieldBalancesCommand) {
    return yield* yieldApi
      .YieldsControllerGetAggregateBalances({ payload: command })
      .pipe(decodeApiResponse("yield-balances", EarnPositionsResponse));
  });

  const getCatalogPositions = Effect.fn(
    "StakeKitApiService.yield.getCatalogPositions"
  )(function* (request: {
    readonly address: string;
    readonly network: Network;
  }) {
    return yield* yieldApi
      .YieldsControllerGetAggregateBalances({
        payload: {
          queries: [{ address: request.address, network: request.network }],
        },
      })
      .pipe(decodeApiResponse("positions-data", EarnPositionsResponse));
  });

  const getSingleYieldBalances = Effect.fn(
    "StakeKitApiService.yield.getSingleYieldBalances"
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

  const getHealth = Effect.fn("StakeKitApiService.yield.getHealth")(
    function* () {
      return yield* yieldApi
        .HealthControllerHealth(undefined)
        .pipe(decodeApiResponse("yield-api-health", HealthStatus));
    }
  );

  const getProvider = Effect.fn("StakeKitApiService.yield.getProvider")(
    function* (providerId: ProviderId) {
      return yield* yieldApi
        .ProvidersControllerGetProvider(providerId, undefined)
        .pipe(decodeApiResponse("yield-provider", EarnProvider));
    }
  );

  const getYield = Effect.fn("StakeKitApiService.yield.getYield")(function* (
    yieldId: YieldId
  ) {
    return yield* yieldApi
      .YieldsControllerGetYield(yieldId, undefined)
      .pipe(decodeApiResponse("yield-opportunity", EarnYield));
  });

  const getInitialYield = Effect.fn("StakeKitApiService.yield.getInitialYield")(
    function* (yieldId: YieldId) {
      return yield* yieldApi
        .YieldsControllerGetYield(yieldId, undefined)
        .pipe(decodeApiResponse("init-yield", EarnYield));
    }
  );

  const getYields = Effect.fn("StakeKitApiService.yield.getYields")(function* (
    request: YieldsRequest
  ) {
    return yield* yieldApi
      .YieldsControllerGetYields({ params: toYieldsParams(request) })
      .pipe(decodeApiResponse("earn-yield-catalog", EarnYieldPage));
  });

  const getAvailableYields = Effect.fn(
    "StakeKitApiService.yield.getAvailableYields"
  )(function* (request: YieldsRequest) {
    return yield* yieldApi
      .YieldsControllerGetYields({ params: toYieldsParams(request) })
      .pipe(
        decodeApiResponse(
          "available-yield-categories",
          AvailableYieldCategoriesPage
        )
      );
  });

  const getTokenScopeYields = Effect.fn(
    "StakeKitApiService.yield.getTokenScopeYields"
  )(function* (request: YieldsRequest) {
    return yield* yieldApi
      .YieldsControllerGetYields({ params: toYieldsParams(request) })
      .pipe(decodeApiResponse("token-yield-scope", TokenYieldScopePage));
  });

  const getValidators = Effect.fn("StakeKitApiService.yield.getValidators")(
    function* (request: YieldValidatorsRequest) {
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
        .pipe(decodeApiResponse("yield-validators", EarnValidatorPage));
    }
  );

  const getYieldTokens = Effect.fn("StakeKitApiService.yield.getYieldTokens")(
    function* (request: YieldTokensRequest) {
      return yield* yieldApi
        .TokensControllerGetTokens({
          params: {
            limit: request.limit,
            ...(request.networks ? { networks: [...request.networks] } : {}),
            offset: request.offset,
            ...(request.yieldTypes
              ? { yieldTypes: [...request.yieldTypes] }
              : {}),
          },
        })
        .pipe(decodeApiResponse("yield-token-options", EarnTokenPage));
    }
  );

  const getActivityActions = Effect.fn(
    "StakeKitApiService.yield.getActivityActions"
  )(function* (query: ActivityActionsQuery) {
    return yield* yieldApi
      .ActionsControllerGetActions({ params: query })
      .pipe(decodeApiResponse("activity-actions", ActivityActionsPage));
  });

  const getKycStatus = Effect.fn("StakeKitApiService.yield.getKycStatus")(
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
    "StakeKitApiService.yield.getRewardRateHistory"
  )(function* (request: {
    readonly interval: "day" | "week";
    readonly period: HistoryPeriod;
    readonly yieldId: YieldId;
  }) {
    return yield* yieldApi
      .YieldsControllerGetYieldRewardRateHistory(request.yieldId, {
        params: {
          interval: request.interval,
          period: request.period,
        },
      })
      .pipe(
        decodeApiResponse(
          "yield-reward-rate-history",
          RewardRateHistoryResponse
        )
      );
  });

  const getTvlHistory = Effect.fn("StakeKitApiService.yield.getTvlHistory")(
    function* (request: {
      readonly interval: "day" | "week";
      readonly period: HistoryPeriod;
      readonly yieldId: YieldId;
    }) {
      return yield* yieldApi
        .YieldsControllerGetYieldTvlHistory(request.yieldId, {
          params: {
            interval: request.interval,
            period: request.period,
          },
        })
        .pipe(decodeApiResponse("yield-tvl-history", TvlHistoryResponse));
    }
  );

  return {
    getActivityActions,
    getAvailableYields,
    getCatalogPositions,
    getHealth,
    getInitialYield,
    getKycStatus,
    getProvider,
    getRewardRateHistory,
    getSingleYieldBalances,
    getTokenScopeYields,
    getTransactionStatus,
    getTvlHistory,
    getValidators,
    getYield,
    getYieldPositions,
    getYieldTokens,
    getYields,
    previewAction,
    submitSignedTransaction,
    submitTransactionHash,
  } as const;
};
