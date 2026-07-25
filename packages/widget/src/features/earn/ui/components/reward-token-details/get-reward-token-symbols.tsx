import React from "react";
import type { AppToken } from "../../../../../domain/schema/legacy-models";
import { tokenString } from "../../../../../domain/types/tokens";
import { Box } from "../../../../../shared/ui/primitives/box";
import { symbolIcon } from "./symbol.css";

export const getRewardTokenSymbols = (rewardTokens: AppToken[]) =>
  rewardTokens.map((token, index) =>
    token.isPoints ? (
      <Box as="span" display="inline-block" key={tokenString(token)}>
        <Box
          display="inline-block"
          className={symbolIcon}
          as="img"
          src={token.logoURI}
          hw="5"
          marginRight="1"
        />

        {maybeAddComma({
          length: rewardTokens.length,
          index,
          value: token.name.replace(/points/i, "").trim(),
        })}
      </Box>
    ) : (
      <React.Fragment key={tokenString(token)}>
        {maybeAddComma({
          length: rewardTokens.length,
          index,
          value: token.symbol,
        })}
      </React.Fragment>
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
