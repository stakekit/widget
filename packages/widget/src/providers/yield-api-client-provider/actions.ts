import type {
  AddressesDto,
  ActionDto as LegacyActionDto,
  TokenDto,
  YieldDto,
} from "@stakekit/api-hooks";
import { adaptActionDto } from "./compat";
import { getResponseData } from "./request-helpers";
import type {
  YieldApiFetchClient,
  YieldCreateActionDto,
  YieldCreateManageActionDto,
} from "./types";

export const createEnterAction = async ({
  addresses,
  fetchClient,
  inputToken,
  requestDto,
  yieldDto,
}: {
  addresses: AddressesDto;
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
  fetchClient: YieldApiFetchClient;
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
