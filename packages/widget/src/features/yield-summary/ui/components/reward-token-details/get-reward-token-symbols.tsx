import { Fragment } from "react";
import type { Token } from "../../../../../domain/token/token";
import { tokenString } from "../../../../../domain/token/token";
import { TokenAvatar } from "../../../../../ui/index";

export const getRewardTokenSymbols = (rewardTokens: Token[]) =>
  rewardTokens.map((token, index) =>
    token.isPoints ? (
      <Fragment key={tokenString(token)}>
        <TokenAvatar
          size="xs"
          name={token.name}
          decorative
          {...(token.logoURI ? { src: token.logoURI } : {})}
        />
        &nbsp;
        {maybeAddComma({
          length: rewardTokens.length,
          index,
          value: token.name.replace(/points/i, "").trim(),
        })}
      </Fragment>
    ) : (
      <Fragment key={tokenString(token)}>
        {maybeAddComma({
          length: rewardTokens.length,
          index,
          value: token.symbol,
        })}
      </Fragment>
    )
  );

const maybeAddComma = ({
  length,
  index,
  value,
}: {
  readonly index: number;
  readonly length: number;
  readonly value: string;
}) => (index !== length - 1 ? <>{value},&nbsp;</> : value);
