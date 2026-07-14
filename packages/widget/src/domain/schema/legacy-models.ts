import { Schema } from "effect";
import * as LegacyApi from "../../generated/api/legacy-schema";
import * as YieldApi from "../../generated/api/yield-schema";
import { TokenAddress } from "./identifiers";

export const AppToken = Schema.Struct({
  ...YieldApi.TokenDto.fields,
  address: Schema.optionalKey(TokenAddress),
  decimals: Schema.Number.check(Schema.isInt()),
});
export type AppToken = typeof AppToken.Type;

export const GeolocationError = LegacyApi.GeolocationError;
export type GeolocationError = typeof GeolocationError.Type;

export const FeeConfiguration = LegacyApi.FeeConfigurationDto;
export type FeeConfiguration = typeof FeeConfiguration.Type;

export const LegacyPendingAction = LegacyApi.PendingActionDto;
export type LegacyPendingAction = typeof LegacyPendingAction.Type;

export const LegacyTransaction = LegacyApi.TransactionDto;
export type LegacyTransaction = typeof LegacyTransaction.Type;

export const TronResource = LegacyApi.TronResourceType;
export type TronResource = typeof TronResource.Type;

export const ActivityActionsQuery = YieldApi.ActionsControllerGetActionsParams;
export type ActivityActionsQuery = typeof ActivityActionsQuery.Type;
