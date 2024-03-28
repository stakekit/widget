import {
  AddressesDto,
  PendingActionDto,
  YieldBalanceDto,
  YieldDto,
  useYieldGetSingleYieldBalancesHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { Override } from "../../types";
import { getAdditionalAddresses } from "../../providers/sk-wallet/use-additional-addresses";
import { preparePendingActionRequestDto } from "../../pages/position-details/hooks/utils";
import { getYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { useSKWallet } from "../../providers/sk-wallet";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { useOnPendingAction } from "../../pages/position-details/hooks/use-on-pending-action";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../domain";
import { useSKQueryClient } from "../../providers/query-client";
import { Connector } from "wagmi";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address, connector } = useSKWallet();

  const onPendingAction = useOnPendingAction();

  const queryClient = useSKQueryClient();

  const yieldGetSingleYieldBalances = useYieldGetSingleYieldBalancesHook();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

  return useQuery({
    staleTime: Infinity,
    gcTime: Infinity,
    queryKey: ["pending-action-deep-link", isLedgerLive, address],
    enabled: !!(isConnected && address && connector),
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(address)
            .chain((add) =>
              Maybe.fromNullable(connector).map((conn) => ({
                connector: conn,
                address: add,
              }))
            )
            .toEither(new Error("missing wagmi config"))
        ).chain((data) =>
          fn({
            isLedgerLive,
            onPendingAction: onPendingAction.mutateAsync,
            address: data.address,
            connector: data.connector,
            queryClient,
            yieldGetSingleYieldBalances,
            yieldYieldOpportunity,
          })
        )
      ).unsafeCoerce(),
  });
};

const fn = ({
  isLedgerLive,
  onPendingAction,
  address,
  connector,
  queryClient,
  yieldGetSingleYieldBalances,
  yieldYieldOpportunity,
}: {
  isLedgerLive: boolean;
  onPendingAction: ReturnType<typeof useOnPendingAction>["mutateAsync"];
  address: string;
  connector: Connector;
  queryClient: QueryClient;
  yieldGetSingleYieldBalances: ReturnType<
    typeof useYieldGetSingleYieldBalancesHook
  >;
  yieldYieldOpportunity: ReturnType<typeof useYieldYieldOpportunityHook>;
}) =>
  getInitialQueryParams({
    isLedgerLive,
    queryClient,
    yieldYieldOpportunity,
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
        getAdditionalAddresses(connector)
          .map<AddressesDto>((additionalAddresses) => ({
            address,
            additionalAddresses: additionalAddresses ?? undefined,
          }))
          .chain((data) =>
            withRequestErrorRetry({
              fn: () =>
                yieldGetSingleYieldBalances(initQueryParams.yieldId, {
                  addresses: {
                    address: data.address,
                    additionalAddresses: data.additionalAddresses,
                  },
                }),
            })
              .mapLeft(() => new Error("could not get yield balances"))
              .map((val) => ({
                yieldId: initQueryParams.yieldId,
                pendingaction: initQueryParams.pendingaction,
                validatorAddress: initQueryParams.validator,
                singleYieldBalances: val,
                address: data.address,
                additionalAddresses: data.additionalAddresses,
              }))
          )
      )
      .chain((data) =>
        EitherAsync.liftEither(
          Right(data.singleYieldBalances).chain((balances) => {
            for (const balance of balances) {
              if (
                data.validatorAddress &&
                balance.validatorAddress !== data.validatorAddress
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
                  balanceId: balance.groupId ?? "default",
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
              yieldYieldOpportunity,
            }).map((yieldOp) => ({ ...val, yieldOp }))
          )
          .chain<
            Error,
            | {
                type: "positionDetails";
                yieldOp: YieldDto;
                pendingAction: PendingActionDto;
                balance: YieldBalanceDto;
                balanceId: string;
              }
            | ({ type: "review"; balanceId: string } & Awaited<
                ReturnType<typeof onPendingAction>
              >)
          >((val) =>
            PAMultiValidatorsRequired(val.pendingAction) ||
            PASingleValidatorRequired(val.pendingAction)
              ? EitherAsync.liftEither(
                  Right({
                    type: "positionDetails",
                    ...val,
                  })
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
                )
                  .chain((pendingActionRequestDto) =>
                    EitherAsync(() =>
                      onPendingAction({
                        pendingActionRequestDto,
                        yieldBalance: val.balance,
                      })
                    ).mapLeft((e) => {
                      return new Error("on pending action failed");
                    })
                  )
                  .map((res) => ({
                    ...res,
                    type: "review",
                    balanceId: val.balanceId,
                  }))
          )
      );
  });
