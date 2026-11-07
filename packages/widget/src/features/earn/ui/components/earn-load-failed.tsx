import { useTranslation } from "react-i18next";
import { ErrorState } from "../../../../ui/index";
import { useEarnPageStatus } from "../../react/use-earn-facades";

/**
 * The Earn form failed to load what it needs, such as the yields: one error
 * in the form's place with a retry, never the "no yield opportunities" copy,
 * and no call to action to press.
 */
export const EarnLoadFailed = () => {
  const { t } = useTranslation();
  const { retry } = useEarnPageStatus();

  return (
    <ErrorState
      fill
      title={t("details.load_failed_title")}
      body={t("shared.load_failed_description")}
      action={{ label: t("shared.retry"), onClick: () => retry(undefined) }}
      testId="earn-load-failed"
    />
  );
};
