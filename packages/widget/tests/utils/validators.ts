import { Schema } from "effect";
import { EarnValidator } from "../../src/domain/schema/earn-models";

export const decodeValidator = (validator: typeof EarnValidator.Encoded) =>
  Schema.decodeUnknownSync(EarnValidator)(validator);
