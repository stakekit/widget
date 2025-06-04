import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "@sk-widget/domain";
import { getYieldOpportunity } from "@sk-widget/hooks/api/use-yield-opportunity/get-yield-opportunity";
import { getInitParams } from "@sk-widget/hooks/use-init-params";
import { useWhitelistedValidators } from "@sk-widget/hooks/use-whitelisted-validators";
import { preparePendingActionRequestDto } from "@sk-widget/pages/position-details/hooks/utils";
import { useSKQueryClient } from "@sk-widget/providers/query-client";
import { useSettings } from "@sk-widget/providers/settings";
import { useSKWallet } from "@sk-widget/providers/sk-wallet";
import type { GetEitherRight, Override } from "@sk-widget/types/utils";
import {
  type AddressWithTokenDtoAdditionalAddresses,
  type PendingActionDto,
  type YieldBalanceDto,
  type YieldDto,
  yieldGetSingleYieldBalances,
} from "@stakekit/api-hooks";
import type { QueryClient } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { EitherAsync, Left, Maybe, Right } from "purify-ts";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address, connector, additionalAddresses } =
    useSKWallet();

  const queryClient = useSKQueryClient();

  const { externalProviders } = useSettings();

  const whitelistedValidatorAddresses = useWhitelistedValidators();

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
            externalProviders,
            whitelistedValidatorAddresses,
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
  externalProviders,
  whitelistedValidatorAddresses,
}: {
  isLedgerLive: boolean;
  address: string;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
  queryClient: QueryClient;
  externalProviders: ReturnType<typeof useSettings>["externalProviders"];
  whitelistedValidatorAddresses: Set<string> | null;
}) =>
  getInitParams({
    isLedgerLive,
    queryClient,
    externalProviders,
    whitelistedValidatorAddresses,
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
          yieldGetSingleYieldBalances(initQueryParams.yieldId, {
            addresses: {
              address,
              additionalAddresses: additionalAddresses ?? undefined,
            },
          })
        )
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
              whitelistedValidatorAddresses,
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
            | {
                type: "review";
                yieldOp: YieldDto;
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
