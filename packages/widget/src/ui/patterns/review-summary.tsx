import * as stylex from "@stylexjs/stylex";
import { TokenAvatar } from "../components/avatar";
import { DetailList, DetailRow } from "../components/detail-list";
import { Divider } from "../components/divider";
import { InfoTip } from "../components/info-tip";
import { Skeleton } from "../components/skeleton";
import type { HostHook } from "../host-hook";
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
  /** Context under the value, such as its fiat value or what it counts. */
  readonly caption?: string;
  /** The value's text tone, such as `danger` for a figure at risk. */
  readonly tone?: "default" | "warning" | "danger";
  /** Renders as the row's `data-testid`. */
  readonly testId?: string;
  /** Renders as the row's `data-rk`, for hosts to locate it. */
  readonly hostHook?: HostHook;
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
  /** The amount's fiat value, such as "$2.42", under it. */
  readonly amountFiat?: string;
  /** Where the amount goes, such as "Lido Staked ETH via Lido". */
  readonly destination?: string;
  /** The token's logo, at the start of the amount. */
  readonly token?: TokenLogo;
  /**
   * Facts under the amount, such as the reward rate, what the action
   * returns, or how many signatures it takes.
   */
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
 * The summary of a review page: the action, then the amount with its token
 * and fiat value and where it goes, its facts, and its fees.
 */
export const ReviewSummary = ({
  title,
  as = "h2",
  amount,
  amountFiat,
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
          {...(row.caption === undefined ? {} : { caption: row.caption })}
          {...(row.tone === undefined ? {} : { tone: row.tone })}
          {...(row.testId === undefined ? {} : { testId: row.testId })}
          {...(row.hostHook === undefined ? {} : { hostHook: row.hostHook })}
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
  // Beside the avatar, the amount takes the rest of the row and may shrink.
  amount: { flexGrow: 1, overflowWrap: "anywhere", minWidth: 0 },
  // The value's width is unknown while it loads; a short figure's stands in.
  pendingValue: { display: "block", width: space[64] },
});
