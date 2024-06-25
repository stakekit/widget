import type {
  ValidatorDto,
  ValidatorSearchResultDto,
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
} from "@stakekit/api-hooks";
import { useYieldFindValidators } from "@stakekit/api-hooks";
import BigNumber from "bignumber.js";
import { Just, Maybe } from "purify-ts";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { createSelector } from "reselect";
import { importValidator } from "../../../../common/import-validator";
import { useTrackEvent } from "../../../../hooks/tracking/use-track-event";
import { usePositionsData } from "../../../../hooks/use-positions-data";
import { useSKWallet } from "../../../../providers/sk-wallet";

export const usePositions = () => {
  const _positionsData = usePositionsData();
  const positionsDataMapped = useMemo(
    () => positionsTableDataSelector(_positionsData.data),
    [_positionsData.data]
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

  const foundValidators = useYieldFindValidators(
    { query: debouncedValidatorAddressOrName, network: network ?? undefined },
    { query: { enabled: debouncedValidatorAddressOrName.length >= 2 } }
  );

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
        new Array<{
          integrationId: ValidatorSearchResultDto["integrationId"];
          validator: ValidatorDto;
        }>()
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

  return { positionsData, listData, importValidators, showPositions };
};

const positionsTableDataSelector = createSelector(
  (data: ReturnType<typeof usePositionsData>["data"]) => data,
  (data) => {
    return [...data.values()].reduce(
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
      } & (
        | { type: "validators"; validatorsAddresses: string[] }
        | { type: "default" }
      ))[]
    );
  }
);
