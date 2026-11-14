import { Effect } from "effect";

import { ActivityActionsPage } from "../../../domain/activity/models";
import type { ActivityActionsQuery } from "../../../domain/activity/query";
import {
  ActionCommand,
  ActionSimulation,
  YieldAction,
} from "../../../domain/earn/action-models";
import { YieldCampaignPage } from "../../../domain/earn/campaign";
import {
  CampaignPayoutPage,
  WalletCampaignRewardsPage,
} from "../../../domain/earn/campaign-rewards";
import { zeroEncryptedBalance } from "../../../domain/earn/confidential-balance";
import { KycStatus } from "../../../domain/earn/kyc";
import { EarnProviderPage } from "../../../domain/earn/provider";
import {
  EarnPositionsResponse,
  EarnValidatorPage,
  EarnYieldBalancesResponse,
  EarnYieldPage,
} from "../../../domain/earn/responses";
import { EarnYield } from "../../../domain/earn/yield-schema";
import type { YieldBalancesCommand } from "../../../domain/finance/models";
import { HealthStatus } from "../../../domain/health/models";
import type {
  ActionId,
  WalletAddress,
  YieldId,
} from "../../../domain/identity/identifiers";
import {
  type HistoryPeriod,
  RewardRateHistoryResponse,
  TvlHistoryResponse,
  YieldRewardsSummary,
} from "../../../domain/portfolio/models";
import { EnabledWalletNetworksResponse } from "../../../domain/wallet/models";
import type * as YieldApi from "../../../generated/api/yield";
import type {
  ActionSimulationRequest,
  CampaignPayoutsRequest,
  ValidatorDirectoryRequest,
  ProjectCampaignsRequest,
  YieldDirectoryRequest,
} from "../resource-sources";
import {
  decodeApiResponse,
  decodeOptionalApiResponse,
  encodeApiRequest,
} from "./api-operation";

const toYieldDirectoryParams = (request: YieldDirectoryRequest) => ({
  limit: request.limit,
  ...(request.network ? { network: request.network } : {}),
  offset: request.offset,
  ...(request.token ? { token: request.token } : {}),
  ...(request.types ? { types: [...request.types] } : {}),
  ...(request.yieldIds ? { yieldIds: [...request.yieldIds] } : {}),
});

export const makeYieldResourceSource = (yieldApi: YieldApi.YieldApi) => {
  const getActivityAction = Effect.fn("YieldResourceSource.getActivityAction")(
    function* (actionId: ActionId) {
      return yield* yieldApi
        .ActionsControllerGetAction(actionId, undefined)
        .pipe(decodeOptionalApiResponse("activity-action", YieldAction));
    }
  );

  const getEnabledWalletNetworks = Effect.suspend(() =>
    yieldApi
      .NetworksControllerGetNetworks(undefined)
      .pipe(
        decodeApiResponse("enabled-networks", EnabledWalletNetworksResponse),
        Effect.withSpan("YieldResourceSource.getEnabledWalletNetworks")
      )
  );

  const getHealth = Effect.suspend(() =>
    yieldApi
      .HealthControllerHealth(undefined)
      .pipe(
        decodeApiResponse("yield-api-health", HealthStatus),
        Effect.withSpan("YieldResourceSource.getHealth")
      )
  );

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

  // A 404 says the Yield's earnings are not tracked: unsupported, retired,
  // or unknown to the API.
  const getRewardsSummary = Effect.fn("YieldResourceSource.getRewardsSummary")(
    function* (request: {
      readonly address: WalletAddress;
      readonly yieldId: YieldId;
    }) {
      return yield* yieldApi
        .YieldsControllerGetYieldRewardsSummary(request.yieldId, {
          params: { address: request.address },
        })
        .pipe(
          decodeOptionalApiResponse(
            "yield-rewards-summary",
            YieldRewardsSummary
          )
        );
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
        Effect.map((response) => ({
          ...response,
          balances: response.balances.map(zeroEncryptedBalance),
        })),
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

  const listProjectCampaigns = Effect.fn(
    "YieldResourceSource.listProjectCampaigns"
  )(function* (request: ProjectCampaignsRequest) {
    return yield* yieldApi
      .CampaignsControllerGetProjectCampaigns({
        params: {
          limit: request.limit,
          offset: request.offset,
          status: request.status,
        },
      })
      .pipe(decodeApiResponse("project-campaigns", YieldCampaignPage));
  });

  const listWalletCampaignRewards = Effect.fn(
    "YieldResourceSource.listWalletCampaignRewards"
  )(function* (request: { readonly address: WalletAddress }) {
    return yield* yieldApi
      .CampaignsControllerGetCampaignRewards({
        params: { address: request.address },
      })
      .pipe(decodeApiResponse("campaign-rewards", WalletCampaignRewardsPage));
  });

  const listCampaignPayouts = Effect.fn(
    "YieldResourceSource.listCampaignPayouts"
  )(function* (request: CampaignPayoutsRequest) {
    return yield* yieldApi
      .CampaignsControllerGetCampaignPayouts(request.campaignId, {
        params: {
          address: request.address,
          limit: request.limit,
          offset: request.offset,
        },
      })
      .pipe(decodeApiResponse("campaign-payouts", CampaignPayoutPage));
  });

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
      .pipe(
        Effect.map((response) => ({
          ...response,
          items: response.items.map((item) => ({
            ...item,
            balances: item.balances.map(zeroEncryptedBalance),
          })),
        })),
        decodeApiResponse("yield-positions", EarnPositionsResponse)
      );
  });

  const listProviders = Effect.fn("YieldResourceSource.listProviders")(
    function* (request: { readonly limit: number; readonly offset: number }) {
      return yield* yieldApi
        .ProvidersControllerGetProviders({ params: request })
        .pipe(decodeApiResponse("yield-providers", EarnProviderPage));
    }
  );

  // A simulation creates nothing, so it reads like any other request and
  // retries a transient failure.
  const simulateAction = Effect.fn("YieldResourceSource.simulateAction")(
    function* (request: ActionSimulationRequest) {
      const payload = yield* encodeApiRequest(
        "action-simulation-request",
        ActionCommand
      )(request.command);
      const decode = decodeApiResponse("action-simulation", ActionSimulation);
      return yield* request.intent === "enter"
        ? yieldApi.ActionsControllerSimulateEnter({ payload }).pipe(decode)
        : yieldApi.ActionsControllerSimulateExit({ payload }).pipe(decode);
    }
  );

  return {
    getActivityAction,
    getEnabledWalletNetworks,
    getHealth,
    getKycStatus,
    getOpportunity,
    getPositions,
    listProviders,
    getSingleYieldBalances,
    getRewardsSummary,
    getRewardRateHistory,
    getTvlHistory,
    listYields,
    listProjectCampaigns,
    listWalletCampaignRewards,
    listCampaignPayouts,
    listValidators,
    listActivity,
    simulateAction,
  } as const;
};
