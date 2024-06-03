import type { Maybe as OriginalMaybe } from "purify-ts/Maybe";
import type { GetMaybeJust } from "./utils";

module "purify-ts" {
  type OriginalMaybeTypeRef = typeof OriginalMaybe;

  interface MaybeTypeRef extends OriginalMaybeTypeRef {
    fromRecord<T extends Record<string, Maybe<unknown>>>(
      val: T
    ): Maybe<{ [Key in keyof T]: GetMaybeJust<T[Key]> }>;
  }

  export const Maybe: MaybeTypeRef;
  export type Maybe<T> = OriginalMaybe<T>;
}
