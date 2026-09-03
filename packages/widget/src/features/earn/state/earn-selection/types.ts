import { Data } from "effect";
import type { AsyncResult } from "effect/unstable/reactivity/AsyncResult";
import type {
  Atom,
  PullResult,
  Writable,
} from "effect/unstable/reactivity/Atom";
import type { TronResource } from "../../../../domain/action/tron-resource";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../domain/earn/models";
import type { YieldId } from "../../../../domain/identity/identifiers";
import type { PositionsData } from "../../../../domain/portfolio/positions";
import type { Token } from "../../../../domain/token/token";
import type { WalletScopeKey } from "../../../../domain/wallet/wallet-scope";
import type {
  DashboardYieldCategory,
  PreferredTokenYieldsPerNetwork,
} from "../../../../public-api/types";
import type { InitParams } from "../../../../services/wallet/init-params";
import type { PullPage } from "../../../../shared/effect/pagination";
import type {
  YieldValidatorsKey,
  YieldValidatorsPullKey,
} from "./catalog/keys";

export type EarnTokenOption = {
  readonly token: Token;
  readonly availableYields: ReadonlyArray<YieldId>;
  readonly amount: string | null;
  readonly source: "balance" | "default";
};
export type EarnTokenKey = string;

export type EarnCatalogOperation =
  | "available-yield-categories"
  | "earn-token-catalog"
  | "earn-yield-catalog"
  | "positions-data"
  | "preferred-validators"
  | "token-balances-scan"
  | "validators";

export class EarnCatalogError extends Data.TaggedError("EarnCatalogError")<{
  readonly operation: EarnCatalogOperation;
  readonly cause: unknown;
}> {}

export type EarnEntry = {
  readonly walletScope: WalletScopeKey | null;
  readonly walletResolution: "pending" | "settled";
  readonly dashboardVariant: boolean;
  readonly categoryOrder: ReadonlyArray<DashboardYieldCategory>;
  readonly initParams?: InitParams | null;
  readonly preferredTokenYieldsPerNetwork?: PreferredTokenYieldsPerNetwork | null;
};

export type EarnEntryIntent = {
  amountInput: "manual" | "max" | "untouched";
  selectedTokenKey: EarnTokenKey | null;
  selectedYieldId: YieldId | null;
  selectedValidators: ReadonlyArray<EarnValidator> | null;
  selectedProviderYieldId: YieldId | null;
  selectedCategory: DashboardYieldCategory | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: TronResource | null;
};

export type EarnSelection = {
  category: DashboardYieldCategory | null;
  token: EarnTokenOption | null;
  yield: EarnYieldWithProvider | null;
  validators: ReadonlyArray<EarnValidator>;
};

export type EarnSelectionForm = {
  providerYieldId: YieldId | null;
  stakeAmount: string;
  useMaxAmount: boolean;
  tronResource: TronResource | null;
};

export type EarnTokenOptionsState = AsyncResult<
  ReadonlyArray<EarnTokenOption>,
  EarnCatalogError
>;

export type EarnValidatorsResource = {
  readonly enabled: boolean;
  readonly initialValidatorsResultAtom: Atom<
    AsyncResult<
      Readonly<{
        readonly complete: boolean;
        readonly items: ReadonlyArray<EarnValidator>;
      }>,
      EarnCatalogError
    >
  >;
  readonly validatorsPullAtom: (
    key: YieldValidatorsPullKey
  ) => Writable<PullResult<PullPage<EarnValidator>, EarnCatalogError>, void>;
};

export type EarnSelectionView = {
  readonly blockingFailure: boolean;
  readonly selection: EarnSelection;
  readonly form: EarnSelectionForm;
  readonly availableCategories: ReadonlyArray<DashboardYieldCategory>;
  readonly loading: {
    readonly wallet: boolean;
    readonly categories: boolean;
    readonly initialSelection: boolean;
    readonly tokens: boolean;
    readonly yields: boolean;
    readonly positions: boolean;
    readonly validators: boolean;
  };
  readonly empty: {
    readonly categories: boolean;
    readonly tokens: boolean;
    readonly yields: boolean;
    readonly validators: boolean;
  };
  readonly resources: {
    readonly positions: {
      readonly data: PositionsData;
      readonly waiting: boolean;
    };
    readonly tokenOptions: {
      readonly items: ReadonlyArray<EarnTokenOption>;
      readonly waiting: boolean;
    };
    readonly yields: {
      readonly items: ReadonlyArray<EarnYieldWithProvider>;
      readonly waiting: boolean;
    };
    readonly validators: {
      readonly enabled: boolean;
      readonly items: ReadonlyArray<EarnValidator>;
      readonly key: YieldValidatorsKey | null;
    };
  };
  readonly can: {
    readonly selectToken: boolean;
    readonly selectYield: boolean;
    readonly selectValidator: boolean;
    readonly submit: boolean;
  };
};

export const makeDefaultEarnIntent = (): EarnEntryIntent => ({
  amountInput: "untouched",
  selectedProviderYieldId: null,
  selectedTokenKey: null,
  selectedValidators: null,
  selectedYieldId: null,
  stakeAmount: "0",
  tronResource: null,
  useMaxAmount: false,
  selectedCategory: null,
});
