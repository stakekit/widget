import type { DashboardYieldCategory } from "../../../../../../domain/types/yields";
import type { EarnTokenKey, EarnValidatorKey, EarnYieldId } from "../types";

export type EarnAction =
  | {
      readonly type: "token/select";
      readonly tokenKey: EarnTokenKey | null;
    }
  | {
      readonly type: "yield/select";
      readonly yieldId: EarnYieldId | null;
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
      readonly providerYieldId: string | null;
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
      readonly tronResource: string | null;
    };
