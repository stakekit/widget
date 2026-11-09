import { Card, Skeleton, Stack } from "../../../../../ui/index";

/** The entry form while its markets or wallet load. */
export const BorrowFormSkeleton = () => (
  <Stack gap={8} aria-busy>
    {[0, 1].map((index) => (
      <Card key={index} padding={16}>
        <Stack gap={12}>
          <Skeleton shape="line" width="quarter" />
          <Stack direction="row" align="center" justify="between" gap={12}>
            <Skeleton shape="line" width="half" />
            <Skeleton shape="rect" height="sm" width="quarter" />
          </Stack>
          <Skeleton shape="line" width="quarter" />
        </Stack>
      </Card>
    ))}
    <Skeleton shape="rect" height="lg" />
  </Stack>
);

/** A market's details while the catalog loads. */
export const BorrowDetailsSkeleton = () => (
  <Stack gap={16} aria-busy>
    <Stack direction="row" align="center" gap={12}>
      <Skeleton shape="circle" size="lg" />
      <Stack gap={4} grow>
        <Skeleton shape="line" width="half" />
        <Skeleton shape="line" width="threeQuarters" />
      </Stack>
    </Stack>
    <Stack direction="row" gap={16}>
      {[0, 1].map((index) => (
        <Stack key={index} gap={4} grow>
          <Skeleton shape="line" width="half" />
          <Skeleton shape="line" width="threeQuarters" />
        </Stack>
      ))}
    </Stack>
    {[0, 1, 2, 3].map((index) => (
      <Stack key={index} direction="row" justify="between" gap={16}>
        <Skeleton shape="line" width="half" />
        <Skeleton shape="line" width="quarter" />
      </Stack>
    ))}
  </Stack>
);
