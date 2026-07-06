import { Data } from "effect";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";
import type { AsyncResult } from "effect/unstable/reactivity/AsyncResult";
import type {
  Atom,
  PullResult,
  Writable,
} from "effect/unstable/reactivity/Atom";
import type { Networks } from "../../../../../domain/types/chains/networks";
import type { InitParams } from "../../../../../domain/types/init-params";
import type { PositionsData } from "../../../../../domain/types/positions";
import type { PreferredTokenYieldsPerNetwork } from "../../../../../domain/types/stake";
import type { TokenBalanceScanDto } from "../../../../../domain/types/token-balance";
import type { TokenDto } from "../../../../../domain/types/tokens";
import type {
  Validator,
  ValidatorKey,
} from "../../../../../domain/types/validators";
import type { DashboardYieldCategory } from "../../../../../domain/types/yields";
import type { LegacyApiError } from "../../../../../generated/api/legacy";
import type {
  YieldApiError,
  YieldDto,
} from "../../../../../generated/api/yield";
import type { MissingStakeKitApiClient } from "../../../../../providers/effect-atom-runtime/stakekit-api-service";

export type EarnTokenOption = {
  readonly token: TokenDto;
  readonly availableYields: ReadonlyArray<string>;
  readonly amount: string;
  readonly source: "balance" | "default" | "init";
};
export type EarnYieldOption = YieldDto;
export type EarnValidatorOption = Validator;

export type EarnTokenKey = string;
export type EarnYieldId = string;
export type EarnValidatorKey = ValidatorKey;

export type EarnCatalogOperation =
  | "available-yield-categories"
  | "default-token-options"
  | "earn-yield-catalog"
  | "init-token-option"
  | "init-yield"
  | "positions-data"
  | "preferred-validators"
  | "runtime"
  | "token-balances-scan"
  | "token-yield-scope"
  | "validators";

export type EarnCatalogUnderlyingError =
  | HttpClientError.HttpClientError
  | LegacyApiError<string, unknown>
  | MissingStakeKitApiClient
  | YieldApiError<string, unknown>;

export class EarnCatalogError extends Data.TaggedError("EarnCatalogError")<{
  readonly operation: EarnCatalogOperation;
  readonly cause: EarnCatalogUnderlyingError;
}> {}

export type EarnEntryParams = {
  address: string | null;
  additionalAddresses?:
    | TokenBalanceScanDto["addresses"]["additionalAddresses"]
    | null;
  network: Networks | null;
  dashboardVariant: boolean;
  categoryOrder: ReadonlyArray<DashboardYieldCategory>;
  initParams?: InitParams | null;
  preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork | null;
  tokensForEnabledYieldsOnly?: boolean;
};

export class EarnEntryKey extends Data.Class<EarnEntryParams> {}

export type EarnMachineIntent = {
  selectedTokenKey: EarnTokenKey | null;
  selectedYieldId: EarnYieldId | null;
  selectedValidatorKeys: ReadonlySet<EarnValidatorKey>;
  selectedProviderYieldId: string | null;
  selectedCategory: DashboardYieldCategory | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: string | null;
};

type EarnMachineSelection = {
  category: DashboardYieldCategory | null;
  token: EarnTokenOption | null;
  yield: EarnYieldOption | null;
  validators: ReadonlyArray<EarnValidatorOption>;
};

export type EarnMachineForm = {
  providerYieldId: string | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: string | null;
};

export type EarnMachineStatus =
  | "loading-initial-selection"
  | "loading-token-options"
  | "no-tokens"
  | "loading-yields"
  | "no-yields"
  | "ready";

export type EarnTokenOptionsState = AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
>;

export type EarnValidatorsPullParams = {
  readonly search: string | null;
};

type EarnTokenOptionsResource = {
  readonly loadedTokenOptionsAtom: Atom<EarnTokenOptionsState>;
  readonly tokenOptionsPullAtom: Writable<
    PullResult<EarnTokenOption, EarnCatalogError>,
    void
  >;
};

export type EarnValidatorsResource = {
  readonly enabled: boolean;
  readonly loadedValidatorsAtom: Writable<
    Map<EarnValidatorKey, EarnValidatorOption>,
    ReadonlyArray<EarnValidatorOption>
  >;
  readonly validatorsPullAtom: (
    key: EarnValidatorsPullParams
  ) => Writable<PullResult<EarnValidatorOption, EarnCatalogError>, void>;
};

export type EarnMachineView = {
  status: EarnMachineStatus;
  selection: EarnMachineSelection;
  form: EarnMachineForm;
  availableCategories: ReadonlyArray<DashboardYieldCategory>;
  resources: {
    positionsDataAtom: Atom<AsyncResult<PositionsData, EarnCatalogError>>;
    tokenOptions: EarnTokenOptionsResource;
    yieldsResult: AsyncResult<
      ReadonlyArray<EarnYieldOption>,
      EarnCatalogError
    > | null;
    validators: EarnValidatorsResource;
  };
  can: {
    selectToken: boolean;
    selectYield: boolean;
    selectValidator: boolean;
    submit: boolean;
  };
};

export const makeDefaultEarnIntent = (): EarnMachineIntent => ({
  selectedProviderYieldId: null,
  selectedTokenKey: null,
  selectedValidatorKeys: new Set(),
  selectedYieldId: null,
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
  selectedCategory: null,
});
