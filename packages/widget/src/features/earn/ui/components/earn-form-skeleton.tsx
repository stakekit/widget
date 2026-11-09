import { Card, Skeleton, Stack } from "../../../../ui/index";

/**
 * Stands in for the Earn amount while it settles, shaped like it: the
 * section's title above a card holding the amount beside the token pill, and
 * the fiat value and balance at its foot.
 */
export const AmountPanelSkeleton = () => (
  <Stack gap={8} aria-busy>
    <Skeleton shape="line" width="quarter" />
    <Card variant="field" padding={16}>
      <Stack gap={8}>
        <Stack direction="row" align="center" justify="between" gap={12}>
          <Skeleton shape="line" variant="display" width="half" />
          <Skeleton shape="rect" width="quarter" />
        </Stack>
        <Stack direction="row" align="center" justify="between" gap={8}>
          <Skeleton shape="line" variant="caption" width="quarter" />
          <Skeleton shape="line" variant="caption" width="quarter" />
        </Stack>
      </Stack>
    </Card>
  </Stack>
);

/**
 * Stands in for the Earn card while the yields settle, shaped like it: the
 * section's title above a card holding the rate beside the yield pill, and
 * the estimated rewards under them.
 */
export const EarnCardSkeleton = () => (
  <Stack gap={8} aria-busy>
    <Skeleton shape="line" width="quarter" />
    <Card padding={16}>
      <Stack gap={12}>
        <Stack direction="row" align="center" justify="between" gap={8}>
          <Skeleton shape="line" variant="title" width="quarter" />
          <Skeleton shape="rect" width="quarter" />
        </Stack>
        <Stack gap={8}>
          <Skeleton shape="line" variant="caption" width="threeQuarters" />
          <Skeleton shape="line" variant="caption" width="half" />
        </Stack>
      </Stack>
    </Card>
  </Stack>
);
