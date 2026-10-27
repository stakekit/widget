import { useTranslation } from "react-i18next";
import { getYieldTypeLabels } from "../../../../../domain/earn/yield";
import { AmountTokenSectionTitle } from "../../../../../shared/ui/components/amount-token-section";
import {
  useEarnEntry,
  useEarnTokenSelection,
  useEarnYieldSelection,
} from "../../../react/use-earn-facades";

export const SelectTokenTitle = () => {
  const { t } = useTranslation();
  const { view: entry } = useEarnEntry();
  const { view: tokens } = useEarnTokenSelection();
  const { view: yields } = useEarnYieldSelection();

  return (
    <AmountTokenSectionTitle
      isLoading={
        entry.appLoading ||
        tokens.isLoading ||
        yields.isLoading ||
        entry.footerIsLoading
      }
    >
      {entry.selectedStake
        ? getYieldTypeLabels(entry.selectedStake, t).title
        : ""}
    </AmountTokenSectionTitle>
  );
};
