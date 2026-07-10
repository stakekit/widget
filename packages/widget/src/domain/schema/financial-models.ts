import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { AdditionalAddresses } from "./address-models";
import { RewardsToken } from "./dashboard-models";
import { TokenAddress, WalletAddress, YieldId } from "./identifiers";
import { TolerantTopLevelArray } from "./response";
import { PrecisionDecimalFromString } from "./scalars";
import { Network } from "./wallet-models";

export const TokenBalanceScanCommand = Schema.Struct({
  ...LegacyApi.TokenBalanceScanDto.fields,
  addresses: Schema.Struct({
    address: WalletAddress,
    additionalAddresses: Schema.optionalKey(AdditionalAddresses),
  }),
  network: Network,
});
export type TokenBalanceScanCommand = typeof TokenBalanceScanCommand.Type;

export const TokenBalance = Schema.Struct({
  ...LegacyApi.TokenBalanceScanResponseDto.fields,
  amount: PrecisionDecimalFromString,
  availableYields: Schema.Array(YieldId),
  token: RewardsToken,
});
export type TokenBalance = typeof TokenBalance.Type;

export const TokenBalancesResponse = TolerantTopLevelArray(TokenBalance, {
  operation: "token-balances-scan",
});

const GasBalanceAddress = Schema.Struct({
  ...LegacyApi.AddressWithTokenDto.fields,
  address: WalletAddress,
  additionalAddresses: Schema.optionalKey(AdditionalAddresses),
  network: Network,
  tokenAddress: Schema.optionalKey(TokenAddress),
});

export const GasBalancesCommand = Schema.Struct({
  ...LegacyApi.BalancesRequestDto.fields,
  addresses: Schema.Array(GasBalanceAddress).check(Schema.isMinLength(1)),
});
export type GasBalancesCommand = typeof GasBalancesCommand.Type;

export const GasTokenBalancesResponse = TolerantTopLevelArray(TokenBalance, {
  operation: "gas-balance-check",
});

const YieldBalancesQuery = Schema.Struct({
  ...YieldApi.BalancesQueryDto.fields,
  address: WalletAddress,
  network: Network,
  yieldId: Schema.optionalKey(YieldId),
});

export const YieldBalancesCommand = Schema.Struct({
  ...YieldApi.BalancesRequestDto.fields,
  queries: Schema.Array(YieldBalancesQuery)
    .check(Schema.isMinLength(1))
    .check(Schema.isMaxLength(25)),
});
export type YieldBalancesCommand = typeof YieldBalancesCommand.Type;
