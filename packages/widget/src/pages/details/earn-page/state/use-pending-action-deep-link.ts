import { withRequestErrorRetry } from "@sk-widget/common/utils";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "@sk-widget/domain";
import { getYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity";
import { getInitialQueryParams } from "@sk-widget/hooks/use-init-query-params";
import { useOnPendingAction } from "@sk-widget/pages/position-details/hooks/use-on-pending-action";
import { preparePendingActionRequestDto } from "@sk-widget/pages/position-details/hooks/utils";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { Override } from "@sk-widget/types";
import type {
  AddressWithTokenDtoAdditionalAddresses,
  PendingActionDto,
  YieldBalanceDto,
  YieldDto,
} from "@stakekit/api-hooks";
import {
  useYieldGetSingleYieldBalancesHook,
  useYieldYieldOpportunityHook,
} from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address, connector, additionalAddresses } =
    useSKWallet();

  const onPendingAction = useOnPendingAction();

  const queryClient = useSKQueryClient();

  const yieldGetSingleYieldBalances = useYieldGetSingleYieldBalancesHook();
  const yieldYieldOpportunity = useYieldYieldOpportunityHook();

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
            onPendingAction: onPendingAction.mutateAsync,
            additionalAddresses,
            address: addr,
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
  additionalAddresses,
  address,
  queryClient,
  yieldGetSingleYieldBalances,
  yieldYieldOpportunity,
}: {
  isLedgerLive: boolean;
  onPendingAction: ReturnType<typeof useOnPendingAction>["mutateAsync"];
  address: string;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
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
        withRequestErrorRetry({
          fn: () =>
            yieldGetSingleYieldBalances(initQueryParams.yieldId, {
              addresses: {
                address,
                additionalAddresses: additionalAddresses ?? undefined,
              },
            }),
        })
          .mapLeft(() => new Error("could not get yield balances"))
          .map((val) => ({
            yieldId: initQueryParams.yieldId,
            pendingaction: initQueryParams.pendingaction,
            validatorAddress: initQueryParams.validator,
            singleYieldBalances: val,
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
                        pendingActionData: {
                          integrationData: val.yieldOp,
                          interactedToken: val.balance.token,
                        },
                      })
                    ).mapLeft(() => new Error("on pending action failed"))
                  )
                  .map((res) => ({
                    ...res,
                    type: "review",
                    balanceId: val.balanceId,
                  }))
          )
      );
  });
