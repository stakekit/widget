import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../domain";
import type { AddressWithTokenDtoAdditionalAddresses } from "../../../../domain/types/addresses";
import { getPositionBalanceDataKey } from "../../../../domain/types/positions";
import type { Yield } from "../../../../domain/types/yields";
import { getYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity/get-yield-opportunity";
import { getInitParams } from "../../../../hooks/use-init-params";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import { useYieldApiFetchClient } from "../../../../providers/yield-api-client-provider";
import type {
  YieldBalanceDto,
  YieldPendingActionDto,
} from "../../../../providers/yield-api-client-provider/types";
import type { GetEitherRight, Override } from "../../../../types/utils";
import { preparePendingActionRequestDto } from "../../../position-details/hooks/utils";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address, connector, additionalAddresses } =
    useSKWallet();

  const queryClient = useSKQueryClient();
  const yieldApiFetchClient = useYieldApiFetchClient();

  const { externalProviders } = useSettings();

  return useQuery({
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    queryKey: ["pending-action-deep-link", isLedgerLive, address],
    enabled: !!(isConnected && address && connector),
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(address).toEither(
            new Error("missing wagmi config")
          )
        ).chain((addr) =>
          fn({
            isLedgerLive,
            additionalAddresses,
            address: addr,
            queryClient,
            yieldApiFetchClient,
            externalProviders,
          })
        )
      ).unsafeCoerce(),
  });
};

const fn = ({
  isLedgerLive,
  additionalAddresses,
  address,
  queryClient,
  yieldApiFetchClient,
  externalProviders,
}: {
  isLedgerLive: boolean;
  address: string;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
  queryClient: QueryClient;
  yieldApiFetchClient: ReturnType<typeof useYieldApiFetchClient>;
  externalProviders: ReturnType<typeof useSettings>["externalProviders"];
}) =>
  getInitParams({
    isLedgerLive,
    queryClient,
    yieldApiFetchClient,
    externalProviders,
  }).chain((val) => {
    const initQueryParams = Maybe.of(val)
      .filter(
        (
          v
        ): v is Override<
          typeof val,
          { yieldId: string; pendingaction: string }
        > => !!v.yieldId && !!v.pendingaction
      )
      .toEither(new Error("missing yieldId or pendingaction"));

    if (initQueryParams.isLeft()) return EitherAsync.liftEither(Right(null));

    return EitherAsync.liftEither(initQueryParams)
      .chain((initQueryParams) =>
        EitherAsync(() =>
          yieldApiFetchClient.POST("/v1/yields/{yieldId}/balances", {
            params: {
              path: {
                yieldId: initQueryParams.yieldId,
              },
            },
            body: {
              address,
            },
          })
        )
          .chain((response) =>
            EitherAsync.liftEither(
              Maybe.fromNullable(response.data).toEither(
                new Error("could not get yield balances")
              )
            )
          )
          .map((val) => ({
            yieldId: initQueryParams.yieldId,
            pendingaction: initQueryParams.pendingaction,
            validatorAddress: initQueryParams.validator,
            singleYieldBalances: val.balances,
            address: address,
            additionalAddresses: additionalAddresses ?? undefined,
          }))
      )
      .chain((data) =>
        EitherAsync.liftEither(
          Right(data.singleYieldBalances).chain((balances) => {
            for (const balance of balances) {
              if (
                data.validatorAddress &&
                balance.validator?.address !== data.validatorAddress &&
                !balance.validators?.some(
                  (validator) => validator.address === data.validatorAddress
                )
              ) {
                continue;
              }

              const pendingAction = balance.pendingActions.find(
                (pa) => pa.type === data.pendingaction
              );

              if (pendingAction) {
                return Right({
                  pendingAction,
                  balance,
                  balanceId: getPositionBalanceDataKey(balance),
                });
              }
            }

            return Left(new Error("no pending action found"));
          })
        )
          .chain((val) =>
            getYieldOpportunity({
              isLedgerLive,
              yieldId: data.yieldId,
              queryClient,
              yieldApiFetchClient,
            }).map((yieldOp) => ({ ...val, yieldOp }))
          )
          .chain<
            Error,
            | {
                type: "positionDetails";
                yieldOp: Yield;
                pendingAction: YieldPendingActionDto;
                balance: YieldBalanceDto;
                balanceId: string;
              }
            | {
                type: "review";
                yieldOp: Yield;
                balance: YieldBalanceDto;
                balanceId: string;
                pendingActionDto: GetEitherRight<
                  ReturnType<typeof preparePendingActionRequestDto>
                >;
              }
          >((val) =>
            PAMultiValidatorsRequired(val.pendingAction) ||
            PASingleValidatorRequired(val.pendingAction)
              ? EitherAsync.liftEither(
                  Right({ type: "positionDetails", ...val })
                )
              : EitherAsync.liftEither(
                  preparePendingActionRequestDto({
                    // TODO: fix this
                    pendingActionsState: new Map(),
                    address: data.address,
                    additionalAddresses: data.additionalAddresses ?? null,
                    integration: val.yieldOp,
                    yieldBalance: val.balance,
                    pendingActionDto: val.pendingAction,
                    selectedValidators: [],
                  })
                ).map((res) => ({
                  yieldOp: val.yieldOp,
                  pendingActionDto: res,
                  type: "review",
                  balanceId: val.balanceId,
                  balance: val.balance,
                }))
          )
      );
  });
