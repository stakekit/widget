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
import {
  PAMultiValidatorsRequired,
  PASingleValidatorRequired,
} from "../../../../domain";
import type { ValidatorsConfig } from "../../../../domain/types/yields";
import { getYieldOpportunity } from "../../../../hooks/api/use-yield-opportunity/get-yield-opportunity";
import { getInitParams } from "../../../../hooks/use-init-params";
import { useValidatorsConfig } from "../../../../hooks/use-validators-config";
import { useSKQueryClient } from "../../../../providers/query-client";
import { useSettings } from "../../../../providers/settings";
import { useSKWallet } from "../../../../providers/sk-wallet";
import type { GetEitherRight, Override } from "../../../../types/utils";
import { preparePendingActionRequestDto } from "../../../position-details/hooks/utils";

export const usePendingActionDeepLink = () => {
  const { isLedgerLive, isConnected, address, connector, additionalAddresses } =
    useSKWallet();

  const queryClient = useSKQueryClient();

  const { externalProviders } = useSettings();

  const validatorsConfig = useValidatorsConfig();

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
            validatorsConfig,
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
  validatorsConfig,
}: {
  isLedgerLive: boolean;
  address: string;
  additionalAddresses: AddressWithTokenDtoAdditionalAddresses | null;
  queryClient: QueryClient;
  externalProviders: ReturnType<typeof useSettings>["externalProviders"];
  validatorsConfig: ValidatorsConfig;
}) =>
  getInitParams({
    isLedgerLive,
    queryClient,
    externalProviders,
    validatorsConfig,
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
              validatorsConfig,
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
