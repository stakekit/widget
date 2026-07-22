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
} from "../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../domain/schema/identifiers";
import type { InitParams } from "../../../../domain/schema/init-params";
import type { PositionsData } from "../../../../domain/types/positions";
import type {
  DashboardYieldCategory,
  PreferredTokenYieldsPerNetwork,
} from "../../../../public-api/types";
import type { WalletScopeKey } from "../../../../services/wallet/domain/scope";
import type { PullPage } from "../../../../shared/effect/pagination";
import type { YieldValidatorsPullKey } from "./catalog/keys";

export type EarnTokenOption = {
  readonly token: EarnToken;
  readonly availableYields: ReadonlyArray<YieldId>;
  readonly amount: string;
  readonly source: "balance" | "default" | "init";
};
export type EarnTokenKey = string;

export type EarnCatalogOperation =
  | "available-yield-categories"
  | "default-token-options"
  | "earn-yield-catalog"
  | "init-token-option"
  | "init-yield"
  | "legacy-token-options"
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

export type EarnEntry = {
  readonly walletScope: WalletScopeKey | null;
  readonly walletResolution: "pending" | "settled";
  readonly dashboardVariant: boolean;
  readonly categoryOrder: ReadonlyArray<DashboardYieldCategory>;
  readonly initParams?: InitParams | null;
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork | null;
  readonly tokensForEnabledYieldsOnly?: boolean;
};

export type EarnMachineIntent = {
  selectedTokenKey: EarnTokenKey | null;
  selectedYieldId: YieldId | null;
  selectedValidatorKeys: ReadonlySet<EarnValidatorKey>;
  selectedProviderYieldId: YieldId | null;
  selectedCategory: DashboardYieldCategory | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: string | null;
};

type EarnMachineSelection = {
  category: DashboardYieldCategory | null;
  token: EarnTokenOption | null;
  yield: EarnYield | null;
  validators: ReadonlyArray<EarnValidator>;
};

export type EarnMachineForm = {
  providerYieldId: YieldId | null;
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

type EarnTokenOptionsResource = {
  readonly loadedTokenOptionsAtom: Atom<EarnTokenOptionsState>;
  readonly tokenOptionsPullAtom: Writable<
    PullResult<PullPage<EarnTokenOption>, EarnCatalogError>,
    void
  >;
};

export type EarnValidatorsResource = {
  readonly enabled: boolean;
  readonly loadedValidatorsAtom: Writable<
    Map<EarnValidatorKey, EarnValidator>,
    ReadonlyArray<EarnValidator>
  >;
  readonly validatorsPullAtom: (
    key: YieldValidatorsPullKey
  ) => Writable<PullResult<PullPage<EarnValidator>, EarnCatalogError>, void>;
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
      ReadonlyArray<EarnYield>,
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
