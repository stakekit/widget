import { Networks } from "@stakekit/common";
import { getStorageItem, setStorageItem } from "../services/local-storage";
import { ValidatorDto, ValidatorSearchResultDto } from "@stakekit/api-hooks";

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
  const prevVal = getStorageItem("sk-widget@1//customValidators")
    .toMaybe()
    .extractNullable();

  if (prevVal) {
    const prevValidators = new Map(
      prevVal[network][address].map((v) => [v.integrationId, v])
    );

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
      ...prevVal,
      [network]: {
        ...prevVal[network],
        [address]: [...prevValidators.values()],
      },
    });
  } else {
    return setStorageItem("sk-widget@1//customValidators", {
      [network]: {
        [address]: [
          {
            integrationId: validatorData.integrationId,
            validatorAddresses: [validatorData.validator.address],
          },
        ],
      },
    });
  }
};
