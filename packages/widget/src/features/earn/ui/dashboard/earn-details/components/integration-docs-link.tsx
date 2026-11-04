import { useTranslation } from "react-i18next";
import { ExternalLink } from "../../../../../../ui/index";

export const IntegrationDocsLink = ({
  documentation,
}: {
  documentation: string;
}) => {
  const { t } = useTranslation();

  return (
    <ExternalLink
      href={documentation}
      newTabLabel={t("shared.opens_in_new_tab")}
    >
      {t("dashboard.earn_details.read_docs")}
    </ExternalLink>
  );
};
