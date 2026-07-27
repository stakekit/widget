import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { Box } from "../../../../../shared/ui/primitives/box";
import { Text } from "../../../../../shared/ui/primitives/typography/text";
import { breadcrumb, breadcrumbName } from "../../../../position-details/ui";
import {
  BackButton,
  BackButtonProvider,
} from "../../../../widget-shell/components";

export const BorrowPositionBreadcrumb = ({
  backPath = "/positions",
  positionName,
}: {
  readonly backPath?: string;
  readonly positionName: string | null;
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <BackButtonProvider>
      <Box className={breadcrumb}>
        <BackButton
          data-testid="borrow-position-details-back"
          onClick={() => navigate(backPath)}
        />

        <Text variant={{ weight: "bold" }}>
          {t("dashboard.position_details.breadcrumb_root")}
        </Text>

        {positionName ? (
          <Text
            className={breadcrumbName}
            variant={{ type: "muted", weight: "normal" }}
          >
            {`/ ${positionName}`}
          </Text>
        ) : null}
      </Box>
    </BackButtonProvider>
  );
};
