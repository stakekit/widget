import { Schema } from "effect";

import { EarnValidator } from "../../src/domain/earn/validator";

export const decodeValidator = (validator: typeof EarnValidator.Encoded) =>
  Schema.decodeSync(EarnValidator)(validator);
