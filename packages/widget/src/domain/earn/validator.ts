import type { EarnValidator } from "./models";

export type ValidatorKey = string;
export type ValidatorInput = Omit<EarnValidator, "key">;
