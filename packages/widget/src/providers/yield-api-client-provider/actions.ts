import type {
  AddressesDto,
  ActionDto as LegacyActionDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import type { Client } from "openapi-fetch";
import type { paths } from "../../types/yield-api-schema";
import { adaptActionDto } from "./compat";
import { getResponseData } from "./request-helpers";
import type { YieldCreateActionDto, YieldCreateManageActionDto } from "./types";

export const createEnterAction = async ({
  addresses,
  fetchClient,
  inputToken,
  requestDto,
  yieldDto,
}: {
  addresses: AddressesDto;
  fetchClient: Client<paths>;
  inputToken: TokenDto;
  requestDto: YieldCreateActionDto;
  yieldDto: YieldDto;
}): Promise<LegacyActionDto> => {
  const actionDto = await getResponseData(
    fetchClient.POST("/v1/actions/enter", {
      body: requestDto,
    })
  );

  return adaptActionDto({
    actionDto,
    addresses,
    gasFeeToken: yieldDto.metadata.gasFeeToken,
    inputToken,
    yieldDto,
  });
};

export const createExitAction = async ({
  addresses,
  fetchClient,
  requestDto,
  yieldDto,
}: {
  addresses: AddressesDto;
  fetchClient: Client<paths>;
  requestDto: YieldCreateActionDto;
  yieldDto: YieldDto;
}): Promise<LegacyActionDto> => {
  const actionDto = await getResponseData(
    fetchClient.POST("/v1/actions/exit", {
      body: requestDto,
    })
  );

  return adaptActionDto({
    actionDto,
    addresses,
    gasFeeToken: yieldDto.metadata.gasFeeToken,
    yieldDto,
  });
};

export const createManageAction = async ({
  addresses,
  fetchClient,
  requestDto,
  yieldDto,
}: {
  addresses: AddressesDto;
  fetchClient: Client<paths>;
  requestDto: YieldCreateManageActionDto;
  yieldDto: YieldDto;
}): Promise<LegacyActionDto> => {
  const actionDto = await getResponseData(
    fetchClient.POST("/v1/actions/manage", {
      body: requestDto,
    })
  );

  return adaptActionDto({
    actionDto,
    addresses,
    gasFeeToken: yieldDto.metadata.gasFeeToken,
    yieldDto,
  });
};

export const listActions = async ({
  address,
  fetchClient,
  limit,
  offset,
}: {
  address: string;
  fetchClient: Client<paths>;
  limit: number;
  offset: number;
}) =>
  getResponseData(
    fetchClient.GET("/v1/actions", {
      params: {
        query: {
          address,
          offset,
          limit,
        },
      },
    })
  );

export const getTransaction = async ({
  fetchClient,
  transactionId,
}: {
  fetchClient: Client<paths>;
  transactionId: string;
}) =>
  getResponseData(
    fetchClient.GET("/v1/transactions/{transactionId}", {
      params: {
        path: {
          transactionId,
        },
      },
    })
  );

export const submitTransaction = async ({
  fetchClient,
  signedTransaction,
  transactionId,
}: {
  fetchClient: Client<paths>;
  signedTransaction: string;
  transactionId: string;
}) =>
  getResponseData(
    fetchClient.POST("/v1/transactions/{transactionId}/submit", {
      params: {
        path: {
          transactionId,
        },
      },
      body: {
        signedTransaction,
      },
    })
  );

export const submitTransactionHash = async ({
  fetchClient,
  hash,
  transactionId,
}: {
  fetchClient: Client<paths>;
  hash: string;
  transactionId: string;
}) =>
  getResponseData(
    fetchClient.PUT("/v1/transactions/{transactionId}/submit-hash", {
      params: {
        path: {
          transactionId,
        },
      },
      body: {
        hash,
      },
    })
  );
