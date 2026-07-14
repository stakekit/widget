import type { EarnValidator } from "../schema/earn-models";

export type ValidatorKey = string;
export type ValidatorInput = Omit<EarnValidator, "key">;
