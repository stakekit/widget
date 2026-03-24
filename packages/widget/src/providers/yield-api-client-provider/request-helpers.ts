import type { YieldActionArgumentsDto } from "../../domain/types/action";
import type { AddressWithTokenDtoAdditionalAddresses } from "../../domain/types/addresses";

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
  promise: Promise<TResponse>,
): Promise<NonNullable<TResponse["data"]>> => {
  const response = await promise;

  if (response.data !== undefined && response.data !== null) {
    return response.data;
  }

  throw response.error ?? new Error("Yield API request failed");
};
