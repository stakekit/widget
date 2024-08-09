import { getYieldTypeLabels } from "@sk-widget/domain/types";
import type { YieldDto } from "@stakekit/api-hooks";
import type { Maybe } from "purify-ts";
import { useTranslation } from "react-i18next";

export const useYieldType = (yieldOpportunity: Maybe<YieldDto>) => {
  const { t } = useTranslation();

  return yieldOpportunity.chainNullable((s) => getYieldTypeLabels(s, t));
};
