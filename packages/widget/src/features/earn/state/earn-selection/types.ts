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
  EarnYieldWithProvider,
} from "../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../domain/schema/identifiers";
import type { InitParams } from "../../../../domain/schema/init-params";
import type { TronResource } from "../../../../domain/schema/legacy-models";
import type { PositionsData } from "../../../../domain/types/positions";
import type {
  DashboardYieldCategory,
  PreferredTokenYieldsPerNetwork,
} from "../../../../public-api/types";
import type { WalletScopeKey } from "../../../../services/wallet/domain/scope";
import type { PullPage } from "../../../../shared/effect/pagination";
import type {
  AvailableYieldCategoriesKey,
  DefaultTokenOptionsKey,
  InitYieldKey,
  PositionsDataKey,
  TokenOptionsKey,
  YieldCatalogKey,
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "./resources/keys";

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

export class EarnCatalogError extends Data.TaggedError("EarnCatalogError")<{
  readonly operation: EarnCatalogOperation;
  readonly cause: unknown;
}> {}

export type EarnRetryTarget =
  | {
      readonly _tag: "AvailableCategories";
      readonly key: AvailableYieldCategoriesKey;
    }
  | { readonly _tag: "InitYield"; readonly key: InitYieldKey }
  | { readonly _tag: "PositionsData"; readonly key: PositionsDataKey }
  | { readonly _tag: "TokenOptions"; readonly key: TokenOptionsKey }
  | { readonly _tag: "YieldCatalog"; readonly key: YieldCatalogKey }
  | { readonly _tag: "YieldValidators"; readonly key: YieldValidatorsKey };

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
  amountInput: "manual" | "max" | "untouched";
  selectedTokenKey: EarnTokenKey | null;
  selectedYieldId: YieldId | null;
  selectedValidatorKeys: ReadonlySet<EarnValidatorKey>;
  selectedProviderYieldId: YieldId | null;
  selectedCategory: DashboardYieldCategory | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: TronResource | null;
};

type EarnMachineSelection = {
  category: DashboardYieldCategory | null;
  token: EarnTokenOption | null;
  yield: EarnYieldWithProvider | null;
  validators: ReadonlyArray<EarnValidator>;
};

export type EarnMachineForm = {
  providerYieldId: YieldId | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: TronResource | null;
};

type EarnMachineStatus =
  | "resolving-wallet"
  | "loading-categories"
  | "no-categories"
  | "loading-initial-selection"
  | "loading-token-options"
  | "no-tokens"
  | "loading-yields"
  | "no-yields"
  | "loading-positions"
  | "loading-validators"
  | "no-validators"
  | "failed"
  | "ready";

type EarnFailureStage =
  | "categories"
  | "initial-selection"
  | "token-options"
  | "yields"
  | "positions"
  | "validators";

type EarnMachineFailure = {
  readonly _tag: "ResourceFailure";
  readonly stage: EarnFailureStage;
  readonly error: EarnCatalogError;
};

export type EarnTokenOptionsState = AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
>;

type EarnTokenOptionsViewResource = {
  readonly items: ReadonlyArray<EarnTokenOption>;
  readonly waiting: boolean;
  readonly pullKey: DefaultTokenOptionsKey | null;
};

export type EarnValidatorsResource = {
  readonly enabled: boolean;
  readonly initialValidatorsResultAtom: Atom<
    AsyncResult<ReadonlyArray<EarnValidator>, EarnCatalogError>
  >;
  readonly rememberValidatorsAtom: Writable<
    ReadonlyMap<EarnValidatorKey, EarnValidator>,
    ReadonlyArray<EarnValidator>
  >;
  readonly validatorsPullAtom: (
    key: YieldValidatorsPullKey
  ) => Writable<PullResult<PullPage<EarnValidator>, EarnCatalogError>, void>;
};

type EarnValidatorsViewResource = {
  readonly enabled: boolean;
  readonly items: ReadonlyArray<EarnValidator>;
  readonly key: YieldValidatorsKey | null;
};

export type EarnMachineView = {
  status: EarnMachineStatus;
  failure: EarnMachineFailure | null;
  retryTarget: EarnRetryTarget | null;
  selection: EarnMachineSelection;
  form: EarnMachineForm;
  availableCategories: ReadonlyArray<DashboardYieldCategory>;
  resources: {
    positions: {
      readonly data: PositionsData;
      readonly waiting: boolean;
    };
    tokenOptions: EarnTokenOptionsViewResource;
    yields: {
      readonly items: ReadonlyArray<EarnYieldWithProvider>;
      readonly waiting: boolean;
    };
    validators: EarnValidatorsViewResource;
  };
  can: {
    selectToken: boolean;
    selectYield: boolean;
    selectValidator: boolean;
    submit: boolean;
  };
};

export const makeDefaultEarnIntent = (): EarnMachineIntent => ({
  amountInput: "untouched",
  selectedProviderYieldId: null,
  selectedTokenKey: null,
  selectedValidatorKeys: new Set(),
  selectedYieldId: null,
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
  selectedCategory: null,
});
