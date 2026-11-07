import { useTranslation } from "react-i18next";

import {
  Card,
  PositionSummary,
  Skeleton,
  Stack,
} from "../../../../../ui/index";

const HeaderSkeleton = () => (
  <Stack direction="row" align="center" gap={12}>
    <Skeleton shape="circle" size="lg" />
    <Stack gap={4} grow>
      <Skeleton shape="line" width="half" />
      <Skeleton shape="line" width="threeQuarters" />
    </Stack>
  </Stack>
);

const SummarySkeleton = () => {
  const { t } = useTranslation();

  return (
    <PositionSummary
      loading
      label={t("position_details.your_position")}
      value=""
      metrics={[
        { label: t("dashboard.borrow.position_details.debt"), value: "" },
        {
          label: t("dashboard.borrow.position_details.health_factor"),
          value: "",
        },
      ]}
    >
      <Skeleton shape="line" />
    </PositionSummary>
  );
};

const ActionsSkeleton = () => (
  <Stack gap={16}>
    <Stack direction="row" gap={8}>
      {[0, 1].map((index) => (
        <Stack key={index} grow>
          <Skeleton shape="rect" height="sm" />
        </Stack>
      ))}
    </Stack>
    <Card padding={16}>
      <Stack gap={8}>
        <Skeleton shape="line" width="quarter" />
        <Skeleton shape="line" width="half" />
      </Stack>
    </Card>
  </Stack>
);

/** The position's actions column while it loads: header, then actions. */
export const BorrowPositionActionsSkeleton = () => (
  <Stack gap={24} aria-busy>
    <HeaderSkeleton />
    <ActionsSkeleton />
  </Stack>
);

/** The position's column while it loads: summary, then details. */
export const BorrowPositionInfoSkeleton = () => (
  <Stack gap={24} aria-busy>
    <SummarySkeleton />
    <Skeleton shape="line" width="quarter" />
  </Stack>
);
