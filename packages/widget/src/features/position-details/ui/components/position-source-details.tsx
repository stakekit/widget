import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, Disclosure, Divider, Stack, Text } from "../../../../ui/index";

/** Who the position is held through, with its facts behind a disclosure. */
export const PositionSourceDetails = ({
  children,
  hasDetails,
  headerAccessory,
  isFirst,
  logo,
  name,
  stakeType,
}: {
  children?: ReactNode;
  hasDetails: boolean;
  headerAccessory?: ReactNode;
  isFirst: boolean;
  logo: string | undefined;
  name: string;
  stakeType: string;
}) => {
  const { t } = useTranslation();
  const title = t("position_details.via", { providerName: name, stakeType });
  const avatar = (
    <Avatar
      {...(logo === undefined ? {} : { src: logo })}
      fallback={name}
      size="sm"
    />
  );
  return (
    <Stack>
      {isFirst && <Divider />}

      {hasDetails ? (
        <Disclosure
          title={title}
          leading={avatar}
          {...(headerAccessory === undefined
            ? {}
            : { badges: headerAccessory })}
          testId="position-source-details-trigger"
        >
          {children}
        </Disclosure>
      ) : (
        <Stack direction="row" align="center" gap={8}>
          {avatar}
          <Text weight="medium">{title}</Text>
          {headerAccessory}
        </Stack>
      )}

      <Divider />
    </Stack>
  );
};
