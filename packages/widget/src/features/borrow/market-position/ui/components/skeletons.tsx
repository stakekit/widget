import { Card, Skeleton, Stack } from "../../../../../ui/index";

export const BorrowPositionActionsSkeleton = () => (
  <Stack gap={12} aria-busy>
    <Skeleton shape="line" width="quarter" />
    {[0, 1].map((index) => (
      <Card key={index} padding={16}>
        <Stack direction="row" align="center" justify="between" gap={12}>
          <Stack gap={8} grow>
            <Skeleton shape="line" width="half" />
            <Skeleton shape="line" width="threeQuarters" />
          </Stack>
          <Skeleton shape="rect" height="sm" width="quarter" />
        </Stack>
      </Card>
    ))}
  </Stack>
);

export const BorrowPositionInfoSkeleton = () => (
  <Stack gap={24} aria-busy>
    <Stack direction="row" align="center" gap={12}>
      <Skeleton shape="circle" size="lg" />
      <Stack gap={4} grow>
        <Skeleton shape="line" width="half" />
        <Skeleton shape="line" width="threeQuarters" />
      </Stack>
    </Stack>

    <Stack direction="row" gap={16} wrap>
      {[0, 1].map((index) => (
        <Stack key={index} gap={4} grow>
          <Skeleton shape="line" width="half" />
          <Skeleton shape="line" width="threeQuarters" />
        </Stack>
      ))}
    </Stack>

    <Stack gap={6}>
      <Stack direction="row" justify="between" gap={8}>
        <Skeleton shape="line" width="quarter" />
        <Skeleton shape="line" width="quarter" />
      </Stack>
      <Skeleton shape="line" />
    </Stack>

    <Stack gap={12}>
      {[0, 1, 2, 3].map((index) => (
        <Stack key={index} direction="row" justify="between" gap={16}>
          <Skeleton shape="line" width="half" />
          <Skeleton shape="line" width="quarter" />
        </Stack>
      ))}
    </Stack>
  </Stack>
);
