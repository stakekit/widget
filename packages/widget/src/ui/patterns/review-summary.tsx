import * as stylex from "@stylexjs/stylex";
import { TokenAvatar } from "../components/avatar";
import { DetailList, DetailRow } from "../components/detail-list";
import { Divider } from "../components/divider";
import { InfoTip } from "../components/info-tip";
import { Skeleton } from "../components/skeleton";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { space } from "../tokens/space.stylex";
import type { TokenLogo } from "./token";

/** One label-value row of a review. */
type ReviewRow = {
  readonly label: string;
  /** Explains the row, behind an info button beside the label. */
  readonly info?: {
    /** Names the info button, such as "About the deposit fee". */
    readonly label: string;
    readonly text: string;
  };
} & (
  | {
      /** The formatted value, such as "$1.20" or "0.5%". */
      readonly value: string;
      readonly loading?: never;
    }
  | {
      /**
       * The value is still loading, such as a gas estimate: a placeholder
       * holds its place while the other rows show.
       */
      readonly loading: true;
      readonly value?: never;
    }
);

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
  /** Where the amount goes, such as "Lido Staked ETH via Lido". */
  readonly destination?: string;
  /** The token's logo beside the title. */
  readonly token?: TokenLogo;
  /** Facts under the amount, such as the reward rate. */
  readonly facts?: ReadonlyArray<ReviewRow>;
  /**
   * The fees, under their heading; `loading` shows placeholders for all of
   * them, before even their labels are known.
   */
  readonly fees?: {
    readonly heading: string;
    readonly rows: ReadonlyArray<ReviewRow>;
    readonly loading?: boolean;
  };
};

/** The fees' heading sits one level under the summary's. */
const subheading = { h1: "h2", h2: "h3", h3: "h4" } as const;

/**
 * The summary of a review page: the action, the amount and where it goes,
 * its facts, and its fees.
 */
export const ReviewSummary = ({
  title,
  as = "h2",
  amount,
  destination,
  token,
  facts = [],
  fees,
}: ReviewSummaryProps) => {
  const feesBusy =
    fees !== undefined &&
    (fees.loading === true || fees.rows.some((row) => row.loading === true));

  return (
    <Stack gap={16}>
      <Stack gap={4}>
        <Stack direction="row" align="center" justify="between" gap={12}>
          <Text variant="title" as={as}>
            {title}
          </Text>
          {token !== undefined && <TokenAvatar {...token} size="md" />}
        </Stack>
        <div {...stylex.props(styles.amount)}>
          <Text variant="display" as="p">
            {amount}
          </Text>
        </div>
        {destination !== undefined && (
          <Text as="p" tone="muted">
            {destination}
          </Text>
        )}
      </Stack>
      {facts.length > 0 && <ReviewRows rows={facts} />}
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
              <ReviewRows rows={fees.rows} />
            )}
          </Stack>
        </>
      )}
    </Stack>
  );
};

const ReviewRows = ({ rows }: { readonly rows: ReadonlyArray<ReviewRow> }) => (
  <DetailList>
    {rows.map((row) => {
      const value =
        row.loading === true ? (
          <span {...stylex.props(styles.pendingValue)}>
            <Skeleton shape="line" />
          </span>
        ) : (
          row.value
        );
      return (
        <DetailRow
          key={row.label}
          label={row.label}
          value={
            row.info === undefined ? (
              value
            ) : (
              <Stack as="span" direction="row" align="center" gap={4}>
                {value}
                <InfoTip label={row.info.label}>{row.info.text}</InfoTip>
              </Stack>
            )
          }
        />
      );
    })}
  </DetailList>
);

const styles = stylex.create({
  // Display figures are about 20px wide; 18 decimals outrun a 400px frame.
  amount: { overflowWrap: "anywhere" },
  // The value's width is unknown while it loads; a short figure's stands in.
  pendingValue: { display: "block", width: space[64] },
});
