import { Skeleton, Stack } from "../../../../ui/index";

/**
 * Stands in for a position's details while they load: its heading, its
 * balance rows and an action card.
 */
export const PositionDetailsSkeleton = () => (
  <Stack gap={16} aria-busy="true" testId="position-details-skeleton">
    <Stack direction="row" align="center" gap={12}>
      <Skeleton shape="circle" size="lg" />
      <Stack grow gap={4}>
        <Skeleton shape="line" width="half" />
        <Skeleton shape="line" width="quarter" />
      </Stack>
    </Stack>
    <Stack gap={8}>
      <Skeleton shape="line" />
      <Skeleton shape="line" />
      <Skeleton shape="line" width="threeQuarters" />
    </Stack>
    <Skeleton shape="rect" height="panel" />
  </Stack>
);
