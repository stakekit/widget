import type { AsyncResult } from "effect/reactivity/AsyncResult";

import type { YieldCategory } from "../../../../../domain/earn/contract";
import type { EarnValidator } from "../../../../../domain/earn/validator";
import type { ValidatorsConfig } from "../../../../../domain/earn/yield";
import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import type { Network } from "../../../../../domain/network/network";
import type { PositionsData } from "../../../../../domain/portfolio/positions";
import type { EarnCatalogError, EarnTokenOption } from "../types";

export type EarnResourceResult<A> = AsyncResult<A, EarnCatalogError>;

export type InitialViewObservations = {
  readonly network: Network | null;
  readonly positions: EarnResourceResult<PositionsData>;
};

export type CategoryObservation =
  | Readonly<{ readonly _tag: "disabled" }>
  | Readonly<{
      readonly _tag: "enabled";
      readonly catalogs: ReadonlyArray<{
        readonly category: YieldCategory;
        readonly result: EarnResourceResult<ReadonlyArray<EarnTokenOption>>;
      }>;
    }>;

export type ValidatorObservation =
  | Readonly<{ readonly _tag: "disabled" }>
  | Readonly<{
      readonly _tag: "enabled";
      readonly complete: boolean;
      readonly options: ReadonlyArray<EarnValidator>;
      /** Directory lookup for a requested validator missing from `options`; null when not needed. */
      readonly requested: EarnResourceResult<EarnValidator | null> | null;
      readonly result: EarnResourceResult<ReadonlyArray<EarnValidator>>;
      readonly validatorsConfig: ValidatorsConfig;
    }>;

export type EarnViewObservations = Readonly<{
  readonly category: CategoryObservation;
  readonly initial: InitialViewObservations;
  /**
   * The yields of every funded token, read only when the token picked for
   * the user has no yield they can reach; null otherwise.
   */
  readonly reachableDefaultYields: EarnResourceResult<
    ReadonlyArray<EarnYieldWithProvider>
  > | null;
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
