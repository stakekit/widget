import { Context, Data, type Effect, type Option, Schema } from "effect";
import type { ActivityActionsPage } from "../../domain/activity/models";
import type { ActivityActionsQuery } from "../../domain/activity/query";
import type { BorrowFeatureDisabled } from "../../domain/borrow/availability";
import type { Integration } from "../../domain/borrow/catalog/integration";
import type { BorrowNetwork } from "../../domain/borrow/network";
import type {
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
import type { EnabledNetworks } from "../../domain/wallet/models";
import { RichError } from "../errors/rich-error";

export type YieldDirectoryRequest = {
  readonly limit: number;
  readonly network?: Network;
  readonly offset: number;
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
  readonly enter: true;
  readonly yieldTypes?: ReadonlyArray<KnownApiYieldType>;
};

export class MissingBorrowApiConfig extends Data.TaggedError(
  "MissingBorrowApiConfig"
)<{
  readonly message: string;
}> {}

export class ApiRequestError extends Schema.TaggedError<ApiRequestError>()(
  "ApiRequestError",
  {
    operation: Schema.String,
    cause: Schema.Defect(),
    richError: Schema.NullOr(RichError),
  }
) {
  constructor(input: {
    readonly operation: string;
    readonly cause: unknown;
    readonly richError?: RichError | null;
  }) {
    super({ ...input, richError: input.richError ?? null });
  }
}

export class ResponseDecodeError extends Schema.TaggedError<ResponseDecodeError>()(
  "ResponseDecodeError",
  {
    operation: Schema.String,
    issue: Schema.String,
    cause: Schema.Defect(),
  }
) {}

export class InputValidationError extends Schema.TaggedError<InputValidationError>()(
  "InputValidationError",
  {
    operation: Schema.String,
    issue: Schema.String,
    cause: Schema.Defect(),
  }
) {}

type ApiReadFailure = ApiRequestError | ResponseDecodeError;
type BorrowReadFailure =
  | ApiReadFailure
  | BorrowFeatureDisabled
  | MissingBorrowApiConfig;

type BorrowResourceSourceService = {
  readonly getIntegrations: () => Effect.Effect<
    typeof BorrowIntegrationsResponse.Type,
    BorrowReadFailure
  >;
  readonly getMarkets: (request: {
    readonly limit: number;
    readonly network: BorrowNetwork;
    readonly offset: number;
    readonly scope: "all";
  }) => Effect.Effect<typeof BorrowMarketsResponse.Type, BorrowReadFailure>;
  readonly getPositionData: (request: {
    readonly address: WalletAddress;
    readonly integrations: ReadonlyArray<Integration>;
    readonly network: BorrowNetwork;
  }) => Effect.Effect<
    typeof BorrowIntegrationPositionsResponse.Type,
    BorrowReadFailure
  >;
};

type LegacyResourceSourceService = {
  readonly getEnabledNetworks: () => Effect.Effect<
    EnabledNetworks,
    ApiReadFailure
  >;
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
  readonly getHealth: () => Effect.Effect<HealthStatus, ApiReadFailure>;
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
