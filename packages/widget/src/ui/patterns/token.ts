/**
 * A token as patterns draw it: its symbol or name, and plain logo URLs the
 * Feature has already resolved.
 */
export type TokenLogo = {
  /** The symbol or name: the avatar's label and its fallback's initial. */
  readonly name: string;
  /** The token's logo URL. */
  readonly src?: string;
  /** The network's logo URL, drawn as a badge on the token's. */
  readonly networkSrc?: string;
};
