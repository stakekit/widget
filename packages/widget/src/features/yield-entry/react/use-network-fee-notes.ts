import { useTranslation } from "react-i18next";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import type { AmountPanelNote } from "../../../ui/index";
import type { MaxGasReserveNote, NetworkFeeNote } from "../model/network-fee";
import { getNetworkFeeNotes } from "../model/network-fee-notes";

/** See `getNetworkFeeNotes`. */
export const useNetworkFeeNotes = ({
  fee,
  maxGasReserve = null,
}: {
  readonly fee: NetworkFeeNote | null;
  readonly maxGasReserve?: MaxGasReserveNote | null;
}): ReadonlyArray<AmountPanelNote> => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  return getNetworkFeeNotes({ fee, locale, maxGasReserve, t });
};
