import { useTranslation } from "react-i18next";
import { Text } from "../../../../../../shared/ui/primitives/typography/text";
import * as styles from "../styles.css";
import { ExternalLinkIcon } from "./external-link-icon";

export const IntegrationDocsLink = ({
  documentation,
}: {
  documentation: string;
}) => {
  const { t } = useTranslation();

  return (
    <Text
      as="a"
      className={styles.integrationDocsLink}
      href={documentation}
      rel="noreferrer"
      target="_blank"
      variant={{ weight: "normal" }}
    >
      {t("dashboard.earn_details.read_docs")}
      <ExternalLinkIcon />
    </Text>
  );
};
