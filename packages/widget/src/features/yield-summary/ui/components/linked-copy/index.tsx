import { Trans, useTranslation } from "react-i18next";
import { ExternalLink } from "../../../../../ui/index";
import type { YieldMetaLinkedCopy } from "../../../model/yield-meta-info";

/** Renders yield copy with its `link0` slot as a "Learn more" link. */
export const LinkedCopy = ({ copy }: { copy: YieldMetaLinkedCopy }) => {
  const { t } = useTranslation();
  return (
    <Trans
      i18nKey={copy.i18nKey}
      components={{
        link0: (
          <ExternalLink
            href={copy.href}
            newTabLabel={t("shared.opens_in_new_tab")}
          >
            {t("shared.learn_more")}
          </ExternalLink>
        ),
      }}
    />
  );
};
