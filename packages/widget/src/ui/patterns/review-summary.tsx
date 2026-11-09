import * as stylex from "@stylexjs/stylex";

import { TokenAvatar } from "../components/avatar";
import { type DetailItem, DetailRows } from "../components/detail-list";
import { Divider } from "../components/divider";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import type { TokenLogo } from "./token";

type ReviewSummaryProps = {
  /** What is being reviewed, such as "Stake". */
  readonly title: string;
  /** The heading level the page's outline needs. */
  readonly as?: "h1" | "h2" | "h3";
  /**
   * The formatted amount with its symbol, such as "1.5 ETH". A long one,
   * such as a full-precision amount, wraps anywhere rather than overflow.
   */
  readonly amount: string;
  /** The amount's fiat value, such as "$2.42", under it. */
  readonly amountFiat?: string;
  /** Where the amount goes, such as "Lido Staked ETH via Lido". */
  readonly destination?: string;
  /**
   * Who runs the action, such as the chosen validator (`square`): its logo
   * leads the destination line.
   */
  readonly provider?: TokenLogo;
  /** The token's logo, at the start of the amount. */
  readonly token?: TokenLogo;
  /**
   * Facts under the amount, such as the reward rate, what the action
   * returns, or how many signatures it takes.
   */
  readonly facts?: ReadonlyArray<DetailItem>;
  /**
   * The fees, under their heading; `loading` shows placeholders for all of
   * them, before even their labels are known.
   */
  readonly fees?:
    | {
        readonly heading: string;
        readonly rows: ReadonlyArray<DetailItem>;
        readonly loading?: boolean;
      }
    | undefined;
};

/** The fees' heading sits one level under the summary's. */
const subheading = { h1: "h2", h2: "h3", h3: "h4" } as const;

/**
 * The summary of a review page: the action, then the amount with its token
 * and fiat value and where it goes, its facts, and its fees.
 */
export const ReviewSummary = ({
  title,
  as = "h2",
  amount,
  amountFiat,
  destination,
  provider,
  token,
  facts = [],
  fees,
}: ReviewSummaryProps) => {
  const feesBusy =
    fees !== undefined &&
    (fees.loading === true || fees.rows.some((row) => row.loading === true));

  return (
    <Stack gap={16}>
      <Stack gap={8}>
        <Text variant="title" as={as}>
          {title}
        </Text>
        <Stack direction="row" align="center" gap={12}>
          {token !== undefined && <TokenAvatar {...token} size="card" />}
          <div {...stylex.props(styles.amount)}>
            <Text variant="display" as="p">
              {amount}
            </Text>
            {amountFiat !== undefined && (
              <Text as="p" tone="muted" numeric>
                {amountFiat}
              </Text>
            )}
          </div>
        </Stack>
        {destination !== undefined && (
          <Stack direction="row" align="center" gap={6}>
            {provider !== undefined && (
              <TokenAvatar {...provider} size="sm" decorative />
            )}
            <Text as="p" tone="muted">
              {destination}
            </Text>
          </Stack>
        )}
      </Stack>
      {facts.length > 0 && <DetailRows rows={facts} />}
      {fees !== undefined && (
        <>
          <Divider />
          <Stack gap={12} aria-busy={feesBusy || undefined}>
            <Text variant="heading" as={subheading[as]}>
              {fees.heading}
            </Text>
            {fees.loading === true ? (
              <Stack gap={12}>
                <Skeleton shape="line" width="full" />
                <Skeleton shape="line" width="half" />
              </Stack>
            ) : (
              <DetailRows rows={fees.rows} />
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
};

const styles = stylex.create({
  // Display figures are about 20px wide; 18 decimals outrun a 400px frame.
  // Beside the avatar, the amount takes the rest of the row and may shrink.
  amount: { flexGrow: 1, overflowWrap: "anywhere", minWidth: 0 },
});
