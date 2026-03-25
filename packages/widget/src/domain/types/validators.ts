import type { ValidatorDto as LegacyValidatorDto } from "@stakekit/api-hooks";
import type { components } from "../../types/yield-api-schema";

export type YieldValidatorDto = components["schemas"]["ValidatorDto"];
export type ValidatorDto = LegacyValidatorDto;

export const toValidatorDto = (
  validatorDto: YieldValidatorDto
): ValidatorDto => {
  return {
    address: validatorDto.address,
    apr: validatorDto.rewardRate?.total,
    commission: validatorDto.commission,
    image: validatorDto.logoURI,
    minimumStake: validatorDto.minimumStake,
    name: validatorDto.name,
    nominatorCount: validatorDto.nominatorCount,
    preferred: validatorDto.preferred,
    pricePerShare: validatorDto.pricePerShare,
    providerId: validatorDto.provider?.id,
    remainingPossibleStake: validatorDto.remainingPossibleStake,
    remainingSlots: validatorDto.remainingSlots,
    stakedBalance: validatorDto.tvl,
    status: validatorDto.status as ValidatorDto["status"],
    subnetId: validatorDto.subnetId,
    subnetName: validatorDto.subnetName,
    tokenSymbol: validatorDto.tokenSymbol,
    votingPower: validatorDto.votingPower,
    website: validatorDto.website,
  };
};
