import type {
  TokenBalanceScanDto as LegacyTokenBalanceScanDto,
  TokenBalanceScanResponseDto as LegacyTokenBalanceScanResponseDto,
  YieldBalanceLabelDto as LegacyYieldBalanceLabelDto,
} from "../../generated/api/legacy";
import type { TokenDto } from "./tokens";

export type TokenBalanceScanDto = LegacyTokenBalanceScanDto;
export type TokenBalanceScanResponseDto = Omit<
  LegacyTokenBalanceScanResponseDto,
  "token"
> & {
  readonly token: TokenDto;
};
export type YieldBalanceLabelDto = LegacyYieldBalanceLabelDto;
