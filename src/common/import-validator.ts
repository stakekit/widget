import { Networks } from "@stakekit/common";
import { getStorageItem, setStorageItem } from "../services/local-storage";
import { ValidatorDto, ValidatorSearchResultDto } from "@stakekit/api-hooks";
import { Left, Maybe, Right } from "purify-ts";

export const importValidator = ({
  address,
  network,
  validatorData,
}: {
  network: Networks;
  address: string;
  validatorData: {
    integrationId: ValidatorSearchResultDto["integrationId"];
    validator: ValidatorDto;
  };
}) => {
  return getStorageItem("sk-widget@1//customValidators")
    .chain((val) =>
      val ? Right(val) : Left(new Error("No custom validators"))
    )
    .caseOf({
      Right: (val) => {
        const prevValidators = Maybe.fromNullable(val[network])
          .chain((v) => Maybe.fromNullable(v[address]))
          .map((v) => new Map(v.map((v) => [v.integrationId, v])))
          .orDefault(new Map());

        const prevValidator = prevValidators.get(validatorData.integrationId);

        prevValidators.set(
          validatorData.integrationId,
          prevValidator
            ? {
                ...prevValidator,
                validatorAddresses: [
                  ...prevValidator.validatorAddresses,
                  validatorData.validator.address,
                ],
              }
            : {
                integrationId: validatorData.integrationId,
                validatorAddresses: [validatorData.validator.address],
              }
        );

        return setStorageItem("sk-widget@1//customValidators", {
          ...val,
          [network]: {
            ...val[network],
            [address]: [...prevValidators.values()],
          },
        });
      },
      Left: () =>
        setStorageItem("sk-widget@1//customValidators", {
          [network]: {
            [address]: [
              {
                integrationId: validatorData.integrationId,
                validatorAddresses: [validatorData.validator.address],
              },
            ],
          },
        }),
    });
};
