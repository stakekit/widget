import type { AddressWithTokenDtoAdditionalAddresses } from "@stakekit/api-hooks";
import type { YieldActionArgumentsDto } from "./types";

export const withAdditionalAddresses = ({
  additionalAddresses,
  argumentsDto,
}: {
  additionalAddresses:
    | AddressWithTokenDtoAdditionalAddresses
    | null
    | undefined;
  argumentsDto: YieldActionArgumentsDto;
}) =>
  ({
    ...argumentsDto,
    ...(additionalAddresses ?? {}),
  }) satisfies YieldActionArgumentsDto;

export const getResponseData = async <
  TResponse extends {
    data?: unknown;
    error?: unknown;
  },
>(
  promise: Promise<TResponse>
): Promise<NonNullable<TResponse["data"]>> => {
  const response = await promise;

  if (response.data !== undefined && response.data !== null) {
    return response.data;
  }

  throw response.error ?? new Error("Yield API request failed");
};
