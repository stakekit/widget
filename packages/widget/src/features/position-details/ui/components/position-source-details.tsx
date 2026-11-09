import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Card, Disclosure, Stack, Text } from "../../../../ui/index";

/**
 * Who the position is held through, on a filled card of its own, with its
 * facts behind a disclosure inside it.
 */
export const PositionSourceDetails = ({
  children,
  hasDetails,
  headerAccessory,
  logo,
  name,
  stakeType,
}: {
  children?: ReactNode;
  hasDetails: boolean;
  headerAccessory?: ReactNode;
  logo: string | undefined;
  name: string;
  stakeType: string;
}) => {
  const { t } = useTranslation();
  const title = t("position_details.via", { providerName: name, stakeType });
  const avatar = <Avatar src={logo} fallback={name} size="sm" />;

  // The disclosure's trigger and content pad themselves, so its card pads
  // less, and both cards keep the title at the same inset.
  return hasDetails ? (
    <Card padding={8}>
      <Disclosure
        title={title}
        leading={avatar}
        badges={headerAccessory}
        testId="position-source-details-trigger"
      >
        {children}
      </Disclosure>
    </Card>
  ) : (
    <Card padding={12}>
      <Stack direction="row" align="center" gap={8}>
        {avatar}
        <Text weight="medium">{title}</Text>
        {headerAccessory}
      </Stack>
    </Card>
  );
};
