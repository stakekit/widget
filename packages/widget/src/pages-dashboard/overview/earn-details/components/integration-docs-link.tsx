import { useTranslation } from "react-i18next";
import { Text } from "../../../../components/atoms/typography/text";
import * as styles from "../styles.css";

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

const ExternalLinkIcon = () => (
  <svg
    aria-hidden="true"
    className={styles.externalLinkIcon}
    fill="none"
    height="14"
    viewBox="0 0 14 14"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M5.25 3.5H3.5C2.5335 3.5 1.75 4.2835 1.75 5.25V10.5C1.75 11.4665 2.5335 12.25 3.5 12.25H8.75C9.7165 12.25 10.5 11.4665 10.5 10.5V8.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M8.75 1.75H12.25V5.25"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
    <path
      d="M6.41699 7.58333L12.2503 1.75"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    />
  </svg>
);
