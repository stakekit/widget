import type { EarnValidatorKey } from "../../../../../domain/schema/earn-models";
import type { YieldId } from "../../../../../domain/schema/identifiers";
import type { TronResource } from "../../../../../domain/schema/legacy-models";
import type { DashboardYieldCategory } from "../../../../../public-api/types";
import type { EarnTokenKey } from "../types";

export type EarnAction =
  | {
      readonly type: "token/select";
      readonly tokenKey: EarnTokenKey | null;
    }
  | {
      readonly type: "yield/select";
      readonly yieldId: YieldId | null;
    }
  | {
      readonly type: "category/select";
      readonly category: DashboardYieldCategory | null;
    }
  | {
      readonly type: "validator/select";
      readonly validatorKey: EarnValidatorKey;
    }
  | {
      readonly type: "validator/multiselect";
      readonly validatorKey: EarnValidatorKey;
    }
  | {
      readonly type: "validator/remove";
      readonly validatorKey: EarnValidatorKey;
    }
  | {
      readonly type: "providerYieldId/select";
      readonly providerYieldId: YieldId | null;
    }
  | {
      readonly type: "stakeAmount/change";
      readonly amount: string;
    }
  | {
      readonly type: "stakeAmount/max";
      readonly amount: string;
    }
  | {
      readonly type: "tronResource/select";
      readonly tronResource: TronResource | null;
    };
