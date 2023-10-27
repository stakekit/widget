import { Maybe } from "purify-ts";

export const MaybeWindow = Maybe.fromNullable(
  typeof window === "undefined" ? null : window
);
