import { AddressesDto, yieldGetSingleYieldBalances } from "@stakekit/api-hooks";
import { withRequestErrorRetry } from "../../common/utils";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";
import { Override } from "../../types";
import { getWagmiConfig } from "../../providers/wagmi";
import { getAdditionalAddresses } from "../../providers/sk-wallet/use-additional-addresses";
import { preparePendingActionRequestDto } from "../../pages/position-details/hooks/utils";
import { onPendingAction } from "../../pages/position-details/hooks/use-on-pending-action";
import { getYieldOpportunity } from "../../hooks/api/use-yield-opportunity";
import { useSKWallet } from "../../providers/sk-wallet";
import { useQuery } from "@tanstack/react-query";
import { getInitialQueryParams } from "../../hooks/use-init-query-params";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected } = useSKWallet();

  return useQuery({
    staleTime: Infinity,
    queryKey: ["pending-action-deep-link"],
    enabled: isConnected,
    queryFn: async () =>
      (await fn({ isLedgerLive })).caseOf({
        Right(value) {
          return Promise.resolve(value);
        },
        Left() {
          return Promise.reject(new Error("no pending action deep link"));
        },
      }),
  });
};

const fn = ({ isLedgerLive }: { isLedgerLive: boolean }) =>
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
      getWagmiConfig({ forceWalletConnectOnly: false }).chain((config) =>
        EitherAsync.liftEither(
          Maybe.fromRecord({
            connector: Maybe.fromNullable(config.wagmiConfig.connector),
            address: Maybe.fromNullable(config.wagmiConfig.data?.account),
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
                  args: { validatorAddresses: [] },
                  addresses: {
                    address: data.address,
                    additionalAddresses: data.additionalAddresses,
                  },
                }),
            }).map((val) => ({
              yieldId: initQueryParams.yieldId,
              pendingaction: initQueryParams.pendingaction,
              validatorAddress: initQueryParams.validator,
              singleYieldBalances: val,
              address: data.address,
              additionalAddresses: data.additionalAddresses,
            }))
          )
      )
    )
    .chain((data) =>
      EitherAsync.liftEither(
        Right(data.singleYieldBalances).chain((v) => {
          for (const balance of v) {
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
                defaultOrValidatorId: balance.validatorAddress ?? "default",
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
        .chain((val) =>
          EitherAsync.liftEither(
            preparePendingActionRequestDto({
              address: data.address,
              additionalAddresses: data.additionalAddresses ?? null,
              integration: val.yieldOp,
              yieldBalance: val.balance,
              pendingActionDto: val.pendingAction,
            })
          )
            .chain((pendingActionRequestDto) =>
              onPendingAction({
                isLedgerLive,
                pendingActionRequestDto,
                yieldBalance: val.balance,
              })
            )
            .map((res) => ({
              ...res,
              defaultOrValidatorId: val.defaultOrValidatorId,
            }))
        )
    );
