import { Context, Data, type Effect, type Option, Schema } from "effect";
import type { YieldAction } from "../../domain/action/models";
import type { ActivityActionsPage } from "../../domain/activity/models";
import type { ActivityActionsQuery } from "../../domain/activity/query";
import type { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import type { Integration } from "../../domain/borrow/catalog/integration";
import type { BorrowMarketsScope } from "../../domain/borrow/catalog/market";
import type { ActionId as BorrowActionId } from "../../domain/borrow/ids";
import type { BorrowNetwork } from "../../domain/borrow/network";
import type {
  BorrowActionsPage,
  BorrowActivityAction,
  BorrowIntegrationPositionsResponse,
  BorrowIntegrationsResponse,
  BorrowMarketsResponse,
} from "../../domain/borrow/responses";
import type {
  EarnLegacyTokenOptionsResponse,
  EarnPositionsResponse,
  EarnProvider,
  EarnValidatorPage,
  EarnYield,
  EarnYieldBalancesResponse,
  EarnYieldPage,
} from "../../domain/earn/models";
import type { KnownApiYieldType } from "../../domain/earn/yield";
import type {
  GasBalancesCommand,
  GasTokenBalancesResponse,
  TokenBalanceScanCommand,
  TokenBalancesResponse,
  YieldBalancesCommand,
} from "../../domain/finance/models";
import type {
  HealthStatus,
  PriceRequest,
  PriceResponse,
} from "../../domain/health/models";
import type {
  ActionId,
  ProviderId,
  WalletAddress,
  YieldId,
} from "../../domain/identity/identifiers";
import type { Network } from "../../domain/network/network";
import type {
  HistoryPeriod,
  KycStatus,
  RewardRateHistoryResponse,
  RewardsAddresses,
  RewardsSummaryRecord,
  TvlHistoryResponse,
} from "../../domain/portfolio/models";
import type { EnabledWalletNetworks } from "../../domain/wallet/models";
import type * as BorrowApi from "../../generated/api/borrow";
import { RichError } from "../errors/rich-error";

export type YieldDirectoryRequest = {
  readonly limit: number;
  readonly network?: Network;
  readonly offset: number;
  readonly token?: string;
  readonly types?: ReadonlyArray<EarnYield["mechanics"]["type"]>;
  readonly yieldIds?: ReadonlyArray<YieldId>;
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

export type EarnTokenCatalogRequest = {
  readonly network?: Network;
  /** Omit to include yields closed to deposits. */
  readonly enter?: true;
  readonly yieldTypes?: ReadonlyArray<KnownApiYieldType>;
};

export type BorrowActionsRequest = {
  readonly address: WalletAddress;
  readonly integrationId?: string;
  readonly limit: number;
  readonly network: BorrowNetwork;
  readonly offset: number;
  readonly statuses?: BorrowApi.ActionsControllerGetActionsV1Params["statuses"];
};

export class MissingBorrowApiConfig extends Data.TaggedError(
  "MissingBorrowApiConfig"
)<{
  readonly message: string;
}> {}

/** How an API request failed, read once from the HTTP exchange. */
export const ApiFailure = Schema.TaggedUnion({
  /** The request never reached the API or got no answer. */
  Unreachable: {},
  /** The widget could not build the request (encoding or URL). */
  InvalidRequest: {},
  /** The API answered with an error status; `body` when it is presentable. */
  ErrorStatus: { status: Schema.Int, body: Schema.NullOr(RichError) },
  /** The API answered, but its body could not be read. */
  UnreadableResponse: { status: Schema.Int },
});
export type ApiFailure = typeof ApiFailure.Type;

/**
 * The Rich Error Identity the widget owns for a request the API never
 * answered; its Error Copy lives with the API's identities.
 */
const unreachableRichError: RichError = { message: "ApiUnreachableError" };

export class ApiRequestError extends Schema.TaggedError<
  ApiRequestError,
  { readonly brand: unique symbol }
>()("ApiRequestError", {
  operation: Schema.String,
  failure: ApiFailure,
  /** The client's original error, kept for diagnostics only. */
  cause: Schema.Defect(),
}) {
  /**
   * What the user is told: the API's explanation when it answered with one,
   * or the widget's no-answer copy.
   */
  get richError(): RichError | null {
    return ApiFailure.match(this.failure, {
      ErrorStatus: ({ body }) => body,
      InvalidRequest: () => null,
      Unreachable: () => unreachableRichError,
      UnreadableResponse: () => null,
    });
  }
}

export class ResponseDecodeError extends Schema.TaggedError<
  ResponseDecodeError,
  { readonly brand: unique symbol }
>()("ResponseDecodeError", {
  operation: Schema.String,
  issue: Schema.String,
  cause: Schema.Defect(),
}) {}

export class InputValidationError extends Schema.TaggedError<
  InputValidationError,
  { readonly brand: unique symbol }
>()("InputValidationError", {
  operation: Schema.String,
  issue: Schema.String,
  cause: Schema.Defect(),
}) {}

type ApiReadFailure = ApiRequestError | ResponseDecodeError;
type BorrowReadFailure =
  | ApiReadFailure
  | BorrowFeatureDisabled
  | MissingBorrowApiConfig;

type BorrowResourceSourceService = {
  readonly getIntegrations: Effect.Effect<
    typeof BorrowIntegrationsResponse.Type,
    BorrowReadFailure
  >;
  readonly getMarkets: (request: {
    readonly limit: number;
    readonly network: BorrowNetwork;
    readonly offset: number;
    readonly scope: BorrowMarketsScope;
  }) => Effect.Effect<typeof BorrowMarketsResponse.Type, BorrowReadFailure>;
  readonly getPositionData: (request: {
    readonly address: WalletAddress;
    readonly integrations: ReadonlyArray<Integration>;
    readonly network: BorrowNetwork;
  }) => Effect.Effect<
    typeof BorrowIntegrationPositionsResponse.Type,
    BorrowReadFailure
  >;
  readonly getAction: (
    actionId: BorrowActionId
  ) => Effect.Effect<Option.Option<BorrowActivityAction>, BorrowReadFailure>;
  readonly listActions: (
    request: BorrowActionsRequest
  ) => Effect.Effect<BorrowActionsPage, BorrowReadFailure>;
};

type LegacyResourceSourceService = {
  readonly getGasTokenBalances: (
    command: GasBalancesCommand
  ) => Effect.Effect<typeof GasTokenBalancesResponse.Type, ApiReadFailure>;
  readonly getPrices: (
    request: PriceRequest
  ) => Effect.Effect<
    typeof PriceResponse.Type,
    ApiReadFailure | InputValidationError
  >;
  readonly getRewardsSummaries: (request: {
    readonly addresses: RewardsAddresses;
    readonly yieldIds: ReadonlyArray<YieldId>;
  }) => Effect.Effect<typeof RewardsSummaryRecord.Type, ApiReadFailure>;
  readonly getTokenOptions: (
    request: EarnTokenCatalogRequest
  ) => Effect.Effect<
    typeof EarnLegacyTokenOptionsResponse.Type,
    ApiReadFailure
  >;
  readonly scanTokenBalances: (
    command: TokenBalanceScanCommand
  ) => Effect.Effect<typeof TokenBalancesResponse.Type, ApiReadFailure>;
};

type YieldResourceSourceService = {
  readonly getActivityAction: (
    actionId: ActionId
  ) => Effect.Effect<Option.Option<YieldAction>, ApiReadFailure>;
  readonly getEnabledWalletNetworks: Effect.Effect<
    EnabledWalletNetworks,
    ApiReadFailure
  >;
  readonly getHealth: Effect.Effect<HealthStatus, ApiReadFailure>;
  readonly getKycStatus: (request: {
    readonly address: WalletAddress;
    readonly yieldId: YieldId;
  }) => Effect.Effect<KycStatus, ApiReadFailure>;
  readonly getOpportunity: (
    yieldId: YieldId
  ) => Effect.Effect<EarnYield, ApiReadFailure>;
  readonly getPositions: (
    command: YieldBalancesCommand
  ) => Effect.Effect<typeof EarnPositionsResponse.Type, ApiReadFailure>;
  readonly getProvider: (
    providerId: ProviderId
  ) => Effect.Effect<Option.Option<EarnProvider>, ApiReadFailure>;
  readonly getRewardRateHistory: (request: {
    readonly interval: "day" | "week";
    readonly period: HistoryPeriod;
    readonly yieldId: YieldId;
  }) => Effect.Effect<typeof RewardRateHistoryResponse.Type, ApiReadFailure>;
  readonly getSingleYieldBalances: (request: {
    readonly address: WalletAddress;
    readonly yieldId: YieldId;
  }) => Effect.Effect<EarnYieldBalancesResponse, ApiReadFailure>;
  readonly getTvlHistory: (request: {
    readonly interval: "day" | "week";
    readonly period: HistoryPeriod;
    readonly yieldId: YieldId;
  }) => Effect.Effect<typeof TvlHistoryResponse.Type, ApiReadFailure>;
  readonly listActivity: (
    query: ActivityActionsQuery
  ) => Effect.Effect<ActivityActionsPage, ApiReadFailure>;
  readonly listValidators: (
    request: ValidatorDirectoryRequest
  ) => Effect.Effect<typeof EarnValidatorPage.Type, ApiReadFailure>;
  readonly listYields: (
    request: YieldDirectoryRequest
  ) => Effect.Effect<typeof EarnYieldPage.Type, ApiReadFailure>;
};

export class BorrowResourceSource extends Context.Service<
  BorrowResourceSource,
  BorrowResourceSourceService
>()("stakekit/widget/services/api/BorrowResourceSource") {}

export class LegacyResourceSource extends Context.Service<
  LegacyResourceSource,
  LegacyResourceSourceService
>()("stakekit/widget/services/api/LegacyResourceSource") {}

export class YieldResourceSource extends Context.Service<
  YieldResourceSource,
  YieldResourceSourceService
>()("stakekit/widget/services/api/YieldResourceSource") {}
