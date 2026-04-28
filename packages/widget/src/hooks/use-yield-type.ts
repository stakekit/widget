import type { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";
import { getYieldTypeLabels, type Yield } from "../domain/types/yields";

export const useYieldType = (yieldOpportunity: Maybe<Yield>) => {
  const { t } = useTranslation();

  return yieldOpportunity.chainNullable((s) => getYieldTypeLabels(s, t));
};
