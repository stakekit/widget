import type { ComponentProps } from "react";

import type { Token } from "../../../../../domain/token/token";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { ReviewSummary } from "../../../../../ui/index";
import type { YieldFlowAttribution } from "../../../model/yield-transaction-flow";

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
  /** Who runs the action: its logo leads the destination. */
  readonly attribution?: YieldFlowAttribution | null;
  /** The token the amount is in: its logo heads the amount. */
  readonly token: Token | null;
  readonly facts?: ReadonlyArray<ReviewFact> | undefined;
  readonly fees?: ReviewSummaryProps["fees"];
};

/** The action under review: its title, amount, facts and fees. */
export const ReviewOverview = ({
  title,
  amount,
  amountFiat,
  destination,
  attribution,
  token,
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
      {...(attribution
        ? {
            provider: {
              name: attribution.name,
              shape: attribution.shape,
              ...(attribution.logo ? { src: attribution.logo } : {}),
            },
          }
        : {})}
      {...(token ? { token: resolveTokenLogo(token) } : {})}
      facts={facts}
      {...(fees === undefined ? {} : { fees })}
    />
  );
};
