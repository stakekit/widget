import {
  AddressesDto,
  PendingActionDto,
  YieldBalanceDto,
  YieldDto,
  yieldGetSingleYieldBalances,
} from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { Override } from "../../types";
import { useWagmiConfig } from "../../providers/wagmi";
import { getAdditionalAddresses } from "../../providers/sk-wallet/use-additional-addresses";
import { preparePendingActionRequestDto } from "../../pages/position-details/hooks/utils";
import { getYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { useSKWallet } from "../../providers/sk-wallet";
import { useQuery } from "@tanstack/react-query";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";
import { useOnPendingAction } from "../../pages/position-details/hooks/use-on-pending-action";
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../domain";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address } = useSKWallet();

  const wagmiConfig = useWagmiConfig();

  const onPendingAction = useOnPendingAction();

  return useQuery({
    staleTime: 0,
    gcTime: 0,
    queryKey: ["pending-action-deep-link", isLedgerLive, address],
    enabled: !!(isConnected && address && wagmiConfig.data?.wagmiConfig),
    queryFn: async () =>
      (
        await EitherAsync.liftEither(
          Maybe.fromNullable(wagmiConfig.data?.wagmiConfig).toEither(
            new Error("missing wagmi config")
          )
        ).chain((wagmiConfig) =>
          fn({
            isLedgerLive,
            onPendingAction: onPendingAction.mutateAsync,
            wagmiConfig,
          })
        )
      ).unsafeCoerce(),
  });
};

const fn = ({
  isLedgerLive,
  onPendingAction,
  wagmiConfig,
}: {
  isLedgerLive: boolean;
  onPendingAction: ReturnType<typeof useOnPendingAction>["mutateAsync"];
  wagmiConfig: NonNullable<
    ReturnType<typeof useWagmiConfig>["data"]
  >["wagmiConfig"];
}) =>
  getInitialQueryParams({ isLedgerLive })
    .chain((val) =>
      EitherAsync.liftEither(
        Maybe.of(val)
          .filter(
            (
              v
            ): v is Override<
              typeof val,
              { yieldId: string; pendingaction: string }
            > => !!v.yieldId && !!v.pendingaction
          )
          .toEither(new Error("missing yieldId or pendingaction"))
      )
    )
    .chain((initQueryParams) =>
      EitherAsync.liftEither(
        Maybe.fromRecord({
          connector: Maybe.fromNullable(wagmiConfig.connector),
          address: Maybe.fromNullable(wagmiConfig.data?.account),
        }).toEither(new Error("missing wagmi config"))
      )
        .chain((wagmiData) =>
          getAdditionalAddresses(wagmiData.connector).map<AddressesDto>(
            (additionalAddresses) => ({
              address: wagmiData.address,
              additionalAddresses: additionalAddresses ?? undefined,
            })
          )
        )
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
          getYieldOpportunity({ isLedgerLive, yieldId: data.yieldId }).map(
            (yieldOp) => ({ ...val, yieldOp })
          )
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
                  ).mapLeft(() => new Error("on pending action failed"))
                )
                .map((res) => ({
                  ...res,
                  type: "review",
                  balanceId: val.balanceId,
                }))
        )
    );
