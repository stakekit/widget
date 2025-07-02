import {
  type YieldFindValidatorsParams,
  yieldFindValidators,
} from "@sk-widget/common/private-api";
import {
  type SettingsContextType,
  useSettings,
} from "@sk-widget/providers/settings";
import { defaultFormattedNumber } from "@sk-widget/utils";
import type {
  ValidatorDto,
  ValidatorSearchResultDto,
  YieldBalanceDto,
  YieldBalanceLabelDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { useQuery } from "@tanstack/react-query";
import BigNumber from "bignumber.js";
import { compare, Just, List, Maybe } from "purify-ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSelector } from "reselect";
import { importValidator } from "../../../../common/import-validator";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const usePositions = () => {
  const { variant } = useSettings();
  const _positionsData = usePositionsData();
  const positionsDataMapped = useMemo(
    () =>
      positionsTableDataSelector({
        positionsData: _positionsData.data,
        variant,
      }),
    [_positionsData.data, variant]
  );

  const positionsData = { ..._positionsData, data: positionsDataMapped };

  const { network, address, isConnected } = useSKWallet();

  const [validatorAddressOrName, setValidatorAddressOrName] = useState("");
  const debouncedValidatorAddressOrName = useDeferredValue(
    validatorAddressOrName
  );

  const onValidatorAddressOrNameChange = (validatorAddress: string) => {
    setValidatorAddressOrName(validatorAddress);
  };

  const foundValidators = useQuery({
    queryKey: getYieldFindValidatorsQueryKey({
      query: debouncedValidatorAddressOrName,
      network: network ?? undefined,
    }),
    queryFn: () =>
      yieldFindValidators({
        query: debouncedValidatorAddressOrName,
        network: network ?? undefined,
      }),
    enabled: debouncedValidatorAddressOrName.length >= 2,
  });

  const foundValidatorsData = Maybe.fromNullable(foundValidators.data)
    .alt(Maybe.of([]))
    .map((val) =>
      val.reduce(
        (acc, val) => {
          val.validators.forEach((v) => {
            acc.push({
              integrationId: val.integrationId,
              validator: v,
            });
          });

          return acc;
        },
        [] as {
          integrationId: ValidatorSearchResultDto["integrationId"];
          validator: ValidatorDto;
        }[]
      )
    );

  const { t } = useTranslation();

  const trackEvent = useTrackEvent();

  const onImportValidatorImport = (val: {
    integrationId: ValidatorSearchResultDto["integrationId"];
    validator: ValidatorDto;
  }) => {
    Maybe.fromRecord({
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((na) => {
      importValidator({ ...na, validatorData: val });
      trackEvent("validatorImported", {
        yieldId: val.integrationId,
        name: val.validator.name,
        address: val.validator.address,
      });
    });
  };

  const importValidators = {
    foundValidatorsData,
    onValidatorAddressOrNameChange,
    isLoading: foundValidators.isLoading,
    errorMessage: foundValidators.error
      ? t("shared.something_went_wrong")
      : undefined,
    onClose: () => setValidatorAddressOrName(""),
    onImportValidatorImport,
  };

  const showPositions =
    isConnected &&
    (!!positionsData.data.length ||
      (!positionsData.isLoading && !positionsData.isError));

  const listData = useMemo(
    () => ["header" as const, ...positionsData.data],
    [positionsData.data]
  );

  return {
    positionsData,
    listData,
    importValidators,
    showPositions,
  };
};

type Input = {
  positionsData: ReturnType<typeof usePositionsData>["data"];
  variant: SettingsContextType["variant"];
};

const positionsTableDataSelector = createSelector(
  (data: Input) => data.positionsData,
  (data: Input) => data.variant,
  (data, variant) =>
    Just([...data.values()])
      .map((val) =>
        val.reduce(
          (acc, val) => {
            [...val.balanceData.entries()].forEach(([id, value]) => {
              Just(
                value.balances.filter((v) =>
                  Just(new BigNumber(v.amount))
                    .filter((v) => !v.isZero() && !v.isNaN())
                    .isJust()
                )
              )
                .filter((v) => !!v.length)
                .ifJust((v) =>
                  acc.push({
                    ...value,
                    integrationId: val.integrationId,
                    balancesWithAmount: v,
                    balanceId: id,
                    allBalances: value.balances,
                    yieldLabelDto: List.find(
                      (b) => !!b.label,
                      value.balances
                    ).chainNullable((v) => v.label),
                    token: List.head(
                      List.sort(
                        (a, b) =>
                          compare(priorityOrder[a.type], priorityOrder[b.type]),
                        value.balances
                      )
                    ).map((v) => ({
                      ...v.token,
                      pricePerShare: v.pricePerShare,
                    })),
                    actionRequired: v.some(
                      (b) => b.type === "locked" || b.type === "unstaked"
                    ),
                    pointsRewardTokenBalance: List.find(
                      (v) => !!v.token.isPoints,
                      v
                    ).map((v) => ({
                      ...v,
                      amount: defaultFormattedNumber(v.amount),
                    })),
                    hasPendingClaimRewards: List.find(
                      (b) => b.type === "rewards",
                      v
                    )
                      .chain((b) =>
                        List.find(
                          (a) => a.type === "CLAIM_REWARDS",
                          b.pendingActions
                        )
                      )
                      .isJust(),
                  })
                );
            });

            return acc;
          },
          [] as ({
            integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
            balancesWithAmount: YieldBalanceDto[];
            allBalances: YieldBalanceDto[];
            balanceId: YieldBalanceDto["groupId"];
            actionRequired: boolean;
            pointsRewardTokenBalance: Maybe<YieldBalanceDto>;
            hasPendingClaimRewards: boolean;
            token: Maybe<YieldBalanceDto["token"] & { pricePerShare: string }>;
            yieldLabelDto: Maybe<YieldBalanceLabelDto>;
          } & (
            | { type: "validators"; validatorsAddresses: string[] }
            | { type: "default" }
          ))[]
        )
      )
      .map((val) =>
        variant === "zerion"
          ? val.toSorted((a, b) => {
              if (a.hasPendingClaimRewards) return -1;
              if (b.hasPendingClaimRewards) return 1;
              return 0;
            })
          : val
      )
      .unsafeCoerce()
);

const priorityOrder: { [key in YieldBalanceDto["type"]]: number } = {
  available: 1,
  staked: 2,
  unstaking: 3,
  unstaked: 4,
  preparing: 5,
  locked: 6,
  unlocking: 7,
  rewards: 8,
};

export const getYieldFindValidatorsQueryKey = (
  params?: YieldFindValidatorsParams
) => {
  return ["/v1/yields/validators", ...(params ? [params] : [])] as const;
};
