import type { AsyncResult } from "effect/unstable/reactivity/AsyncResult";
import type {
  EarnValidator,
  EarnYieldWithProvider,
} from "../../../../../domain/earn/models";
import type { ValidatorsConfig } from "../../../../../domain/earn/yield";
import type { YieldId } from "../../../../../domain/identity/identifiers";
import type { Network } from "../../../../../domain/network/network";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import type { EarnCatalogError, EarnTokenOption } from "../types";

export type EarnResourceResult<A> = AsyncResult<A, EarnCatalogError>;

export type InitialViewObservations = {
  readonly initYield: EarnResourceResult<EarnYieldWithProvider | null>;
  readonly initYieldId: YieldId | null;
  readonly network: Network | null;
  readonly positions: EarnResourceResult<PositionsData>;
  readonly selectionSeedYieldId: YieldId | null;
};

export type CategoryObservation =
  | Readonly<{ readonly _tag: "disabled" }>
  | Readonly<{
      readonly _tag: "enabled";
      readonly result: EarnResourceResult<
        ReadonlyArray<DashboardYieldCategory>
      >;
    }>;

export type ValidatorObservation =
  | Readonly<{ readonly _tag: "disabled" }>
  | Readonly<{
      readonly _tag: "enabled";
      readonly options: ReadonlyArray<EarnValidator>;
      readonly result: EarnResourceResult<ReadonlyArray<EarnValidator>>;
      readonly validatorsConfig: ValidatorsConfig;
    }>;

export type EarnViewObservations = Readonly<{
  readonly category: CategoryObservation;
  readonly initial: InitialViewObservations;
  readonly tokenOptions: EarnResourceResult<ReadonlyArray<EarnTokenOption>>;
  readonly validators: ValidatorObservation;
  readonly yieldCatalog: EarnResourceResult<
    ReadonlyArray<EarnYieldWithProvider>
  >;
}>;

export const disabledValidatorsViewResource = {
  enabled: false,
  items: [],
  key: null,
} as const;
