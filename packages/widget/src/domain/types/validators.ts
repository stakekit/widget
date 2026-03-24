import type { ValidatorDto as LegacyValidatorDto } from "@stakekit/api-hooks";
import type { components } from "../../types/yield-api-schema";

export type YieldValidatorDto = components["schemas"]["ValidatorDto"];
export type ValidatorDto = LegacyValidatorDto;

export const toValidatorDto = (
  validatorDto: YieldValidatorDto | ValidatorDto
): ValidatorDto => {
  const legacyValidator = validatorDto as ValidatorDto;
  const rewardRate =
    "rewardRate" in validatorDto ? validatorDto.rewardRate : undefined;
  const providerId =
    "provider" in validatorDto
      ? (validatorDto.provider?.id ?? validatorDto.providerId)
      : validatorDto.providerId;
  const image =
    "logoURI" in validatorDto ? validatorDto.logoURI : legacyValidator.image;
  const stakedBalance =
    "tvl" in validatorDto ? validatorDto.tvl : legacyValidator.stakedBalance;

  return {
    address: validatorDto.address,
    apr: "apr" in validatorDto ? validatorDto.apr : rewardRate?.total,
    commission: validatorDto.commission,
    image,
    minimumStake: validatorDto.minimumStake,
    name: validatorDto.name,
    nominatorCount: validatorDto.nominatorCount,
    preferred: validatorDto.preferred,
    pricePerShare: validatorDto.pricePerShare,
    providerId,
    remainingPossibleStake: validatorDto.remainingPossibleStake,
    remainingSlots: validatorDto.remainingSlots,
    stakedBalance,
    status: validatorDto.status as ValidatorDto["status"],
    subnetId: validatorDto.subnetId,
    subnetName:
      "subnetName" in validatorDto ? validatorDto.subnetName : undefined,
    tokenSymbol: validatorDto.tokenSymbol,
    votingPower: validatorDto.votingPower,
    website: validatorDto.website,
  };
};
