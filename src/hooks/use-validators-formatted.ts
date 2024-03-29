import { useMemo } from "react";
import { State } from "../state/stake/types";
import { List } from "purify-ts";
import { useTranslation } from "react-i18next";

export const useValidatorsFormatted = (
  selectedValidators: State["selectedValidators"]
) => {
  const { t } = useTranslation();

  return useMemo(() => {
    const vals = [...selectedValidators.values()];

    return List.find((v) => !!(v.name ?? v.address), vals)
      .alt(List.head(vals))
      .map((v) =>
        t("details.selected_validators", {
          providerName: v.name ?? v.address,
          count: vals.length - 1,
        })
      );
  }, [selectedValidators, t]);
};
