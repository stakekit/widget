import { useTranslation } from "react-i18next";
import type { EarnYieldWithProvider } from "../../../domain/schema/earn-models";
import { getYieldTypeLabels } from "../../../domain/types/yields";

export const useYieldType = (
  yieldOpportunity: EarnYieldWithProvider | null
) => {
  const { t } = useTranslation();

  return yieldOpportunity ? getYieldTypeLabels(yieldOpportunity, t) : null;
};
