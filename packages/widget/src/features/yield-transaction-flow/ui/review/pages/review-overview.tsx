import type { ComponentProps } from "react";
import type { YieldMetadata } from "../../../../../domain/earn/yield";
import type { Token } from "../../../../../domain/token/token";
import { useTokenLogoResolver } from "../../../../../shared/react/token-logo";
import { ReviewSummary } from "../../../../../ui/index";

type ReviewSummaryProps = ComponentProps<typeof ReviewSummary>;

export type ReviewFact = Readonly<{
  label: string;
  value: string;
  testId?: string;
}>;

type Props = {
  readonly title: string;
  /** The formatted amount with its symbol, such as "1.5 ETH". */
  readonly amount: string;
  /** What follows the amount, such as the reward rate it earns. */
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
      {...(destination ? { destination } : {})}
      {...(token && metadata
        ? { token: resolveTokenLogo(token, { metadata }) }
        : {})}
      facts={facts.map((fact) => ({
        label: fact.label,
        value: fact.value,
        ...(fact.testId === undefined ? {} : { testId: fact.testId }),
      }))}
      {...(fees === undefined ? {} : { fees })}
    />
  );
};
