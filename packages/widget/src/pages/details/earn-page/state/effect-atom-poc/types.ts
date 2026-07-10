import { Data } from "effect";
import type { AsyncResult } from "effect/unstable/reactivity/AsyncResult";
import type {
  Atom,
  PullResult,
  Writable,
} from "effect/unstable/reactivity/Atom";
import type {
  EarnToken,
  EarnValidator,
  EarnValidatorKey,
  EarnYield,
} from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { Networks } from "../../../../../domain/types/chains/networks";
import type { InitParams } from "../../../../../domain/types/init-params";
import type { PositionsData } from "../../../../../domain/types/positions";
import type { PreferredTokenYieldsPerNetwork } from "../../../../../domain/types/stake";
import type { TokenBalanceScanDto } from "../../../../../domain/types/token-balance";
import type { DashboardYieldCategory } from "../../../../../domain/types/yields";

export type EarnTokenOption = {
  readonly token: EarnToken;
  readonly availableYields: ReadonlyArray<YieldId>;
  readonly amount: string;
  readonly source: "balance" | "default" | "init";
};
export type EarnYieldOption = EarnYield;
export type EarnValidatorOption = EarnValidator;

export type EarnTokenKey = string;
export type EarnYieldId = YieldId;
export type { EarnValidatorKey };

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

export type EarnCatalogUnderlyingError = unknown;

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
  walletResolution: "pending" | "settled";
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
  | "resolving-wallet"
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
