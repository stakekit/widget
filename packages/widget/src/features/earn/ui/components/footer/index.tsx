import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../../../shared/react/widget-presentation";
import {
  getCampaignFooterNote,
  yieldCampaignAtom,
} from "../../../../campaigns/index";
import { MetaInfo } from "../../../../yield-summary/views";
import { useEarnEntry } from "../../use-earn-facades";

export const Footer = ({
  textSize,
}: {
  textSize?: ComponentProps<typeof MetaInfo>["textSize"];
}) => {
  const { view } = useEarnEntry();
  const props = {
    isLoading: view.appLoading || view.footerIsLoading,
    selectedValidators: view.selectedValidators,
    selectedToken: view.selectedToken,
    textSize,
  };

  return view.selectedStake ? (
    <YieldFooter {...props} selectedStake={view.selectedStake} />
  ) : (
    <MetaInfo {...props} selectedStake={null} />
  );
};

/** The yield's notes, with how its campaign pays among them. */
const YieldFooter = ({
  selectedStake,
  ...props
}: Omit<ComponentProps<typeof MetaInfo>, "selectedStake" | "notes"> & {
  readonly selectedStake: EarnYieldWithProvider;
}) => {
  const { t } = useTranslation();
  const { locale } = useWidgetPresentation();
  const campaign = useAtomValue(yieldCampaignAtom(selectedStake.id));

  return (
    <MetaInfo
      {...props}
      selectedStake={selectedStake}
      notes={
        campaign
          ? [
              {
                text: getCampaignFooterNote(campaign, t, locale),
                icon: "SparkleIcon",
              },
            ]
          : []
      }
    />
  );
};
