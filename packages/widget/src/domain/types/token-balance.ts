import type { TokenBalanceScanCommand } from "../schema/financial-models";

export type TokenBalanceScanDto = TokenBalanceScanCommand;

export type YieldBalanceLabelDto = {
  readonly params: Readonly<Record<string, never>>;
  readonly type: string;
};
