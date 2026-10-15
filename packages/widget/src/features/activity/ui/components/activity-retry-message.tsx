import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../../shared/ui/primitives/button";
import { Text } from "../../../../shared/ui/primitives/typography/text";

export const ActivityRetryMessage = ({
  onRetry,
}: {
  readonly onRetry: () => void;
}): ReactElement => {
  const { t } = useTranslation();
  return (
    <>
      <Text variant={{ type: "danger" }} textAlign="center">
        {t("shared.something_went_wrong")}
      </Text>
      <Button onClick={onRetry}>{t("shared.retry")}</Button>
    </>
  );
};
