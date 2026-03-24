import type {
  ActionDto,
  YieldCreateActionDto,
  YieldCreateManageActionDto,
} from "../../domain/types/action";
import type { YieldApiFetchClient } from "../../domain/types/yield-api";
import { getResponseData } from "./request-helpers";

export const createEnterAction = async ({
  fetchClient,
  requestDto,
}: {
  fetchClient: YieldApiFetchClient;
  requestDto: YieldCreateActionDto;
}): Promise<ActionDto> => {
  return getResponseData(
    fetchClient.POST("/v1/actions/enter", {
      body: requestDto,
    })
  );
};

export const createExitAction = async ({
  fetchClient,
  requestDto,
}: {
  fetchClient: YieldApiFetchClient;
  requestDto: YieldCreateActionDto;
}): Promise<ActionDto> => {
  return getResponseData(
    fetchClient.POST("/v1/actions/exit", {
      body: requestDto,
    })
  );
};

export const createManageAction = async ({
  fetchClient,
  requestDto,
}: {
  fetchClient: YieldApiFetchClient;
  requestDto: YieldCreateManageActionDto;
}): Promise<ActionDto> => {
  return getResponseData(
    fetchClient.POST("/v1/actions/manage", {
      body: requestDto,
    })
  );
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
