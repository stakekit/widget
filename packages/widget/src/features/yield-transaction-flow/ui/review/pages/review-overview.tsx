import type { ComponentProps } from "react";
import type { YieldMetadata } from "../../../../../domain/earn/yield";
import type { Token } from "../../../../../domain/token/token";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { ReviewSummary } from "../../../../../ui/index";

type ReviewSummaryProps = ComponentProps<typeof ReviewSummary>;

/** One fact of a review, such as what the action returns. */
export type ReviewFact = NonNullable<ReviewSummaryProps["facts"]>[number];

type Props = {
  readonly title: string;
  /** The formatted amount with its symbol, such as "1.5 ETH". */
  readonly amount: string;
  /** The amount's fiat value, such as "$2.42". */
  readonly amountFiat?: string | null | undefined;
  /** Where the amount goes, such as the yield and its provider. */
  readonly destination?: string | undefined;
  readonly token: Token | null;
  readonly metadata: Pick<
    YieldMetadata,
    "logoURI" | "name" | "provider"
  > | null;
  readonly facts?: ReadonlyArray<ReviewFact> | undefined;
  readonly fees?: ReviewSummaryProps["fees"];
};

/** The action under review: its title, amount, facts and fees. */
export const ReviewOverview = ({
  title,
  amount,
  amountFiat,
  destination,
  token,
  metadata,
  facts = [],
  fees,
}: Props) => {
  const resolveTokenLogo = useTokenLogoResolver();

  return (
    <ReviewSummary
      title={title}
      as="h1"
      amount={amount}
      {...(amountFiat ? { amountFiat } : {})}
      {...(destination ? { destination } : {})}
      {...(token && metadata
        ? { token: resolveTokenLogo(token, { metadata }) }
        : {})}
      facts={facts}
      {...(fees === undefined ? {} : { fees })}
    />
  );
};
