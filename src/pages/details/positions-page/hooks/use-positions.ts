import { usePositionsData } from "../../../../hooks/use-positions-data";
import { createSelector } from "reselect";
import BigNumber from "bignumber.js";
import {
  ValidatorDto,
  ValidatorSearchResultDto,
  YieldBalanceDto,
  YieldBalancesWithIntegrationIdDto,
  useYieldFindValidators,
} from "@stakekit/api-hooks";
import { useState } from "react";
import { Maybe } from "purify-ts";
import { useSKWallet } from "../../../../hooks/wallet/use-sk-wallet";
import { useDebounce } from "../../../../hooks/use-debounce";
import { useTranslation } from "react-i18next";
import { importValidator } from "../../../../common/import-validator";

export const usePositions = () => {
  const { data, ...rest } = usePositionsData();

  const { network, address } = useSKWallet();

  const [validatorAddressOrName, setValidatorAddressOrName] = useState("");
  const debouncedValidatorAddressOrName = useDebounce(
    validatorAddressOrName,
    500
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

  const onImportValidatorImport = (val: {
    integrationId: ValidatorSearchResultDto["integrationId"];
    validator: ValidatorDto;
  }) => {
    Maybe.fromRecord({
      network: Maybe.fromNullable(network),
      address: Maybe.fromNullable(address),
    }).ifJust((na) => importValidator({ ...na, validatorData: val }));
  };

  const importValidators = {
    foundValidatorsData,
    onValidatorAddressOrNameChange,
    isLoading: foundValidators.isInitialLoading,
    errorMessage: foundValidators.error
      ? t("shared.something_went_wrong")
      : undefined,
    onClose: () => setValidatorAddressOrName(""),
    onImportValidatorImport,
  };

  return {
    positionsData: {
      ...rest,
      data: positionsTableDataSelector(data),
    },
    importValidators,
  };
};

/**
 *
 * @summary This selector is used to map object with all default + validator balances to a map
 */
export const positionsTableDataSelector = createSelector(
  (data: ReturnType<typeof usePositionsData>["data"]) => data,
  (data) => {
    return [...data.values()].reduce(
      (acc, val) => {
        Object.entries(val.balanceData).forEach(([key, value]) => {
          if (
            value.some((v) => {
              const amount = new BigNumber(v.amount);

              return !amount.isZero() && !amount.isNaN();
            })
          ) {
            acc.push({
              integrationId: val.integrationId,
              balances: value,
              defaultOrValidatorId: key,
            });
          }
        });

        return acc;
      },
      [] as {
        integrationId: YieldBalancesWithIntegrationIdDto["integrationId"];
        balances: YieldBalanceDto[];
        defaultOrValidatorId: "default" | (string & {}); // either default balance or balance by validator
      }[]
    );
  }
);
