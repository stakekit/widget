import { Schema } from "effect";
import { TokenAddress } from "../../identity/identifiers";

const TokenScopedPositionActionKey = Schema.TemplateLiteral([
  Schema.Literals(["repay", "enableCollateral", "disableCollateral"]),
  Schema.Literal("-"),
  TokenAddress,
]);

/**
 * Identifies a configurable action a borrow market position offers: withdraw
 * is one action across collateral tokens, every other action is per token.
 * Not the API action id; it keys the action's route and form.
 */
export const BorrowPositionActionKey = Schema.Union([
  Schema.Literal("withdraw"),
  TokenScopedPositionActionKey,
]);
export type BorrowPositionActionKey = typeof BorrowPositionActionKey.Type;
