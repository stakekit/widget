import { useAtomValue } from "@effect/atom-react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";

import type { EarnYieldWithProvider } from "../../../domain/earn/yield-schema";
import { useWidgetPresentation } from "../../../shared/react/widget-presentation";
import { MetaInfo } from "../../yield-summary/views";
import { getCampaignFooterNote } from "../model/campaign-copy";
import { yieldCampaignAtom } from "../state/yield-campaign";

type MetaInfoProps = Omit<ComponentProps<typeof MetaInfo>, "notes">;

const YieldCampaignMetaInfo = ({
  selectedStake,
  ...props
}: MetaInfoProps & { readonly selectedStake: EarnYieldWithProvider }) => {
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

/** A yield's notes, with how its campaign pays among them. */
export const CampaignMetaInfo = ({ selectedStake, ...props }: MetaInfoProps) =>
  selectedStake ? (
    <YieldCampaignMetaInfo {...props} selectedStake={selectedStake} />
  ) : (
    <MetaInfo {...props} selectedStake={null} />
  );
