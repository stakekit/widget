import { Schema } from "effect";
import { EarnValidator } from "../schema/earn-models";

export type ValidatorKey = string;
export type Validator = EarnValidator;
export type ValidatorInput = typeof EarnValidator.Encoded;

export const toValidator = (validator: typeof EarnValidator.Encoded) =>
  Schema.decodeUnknownSync(EarnValidator)(validator);
