import { Box } from "@sk-widget/components";
import { tokenString } from "@sk-widget/domain";
import { symbolIcon } from "@sk-widget/hooks/use-reward-token-details/style.css";
import type { TokenDto } from "@stakekit/api-hooks";
import React from "react";

export const getRewardTokenSymbols = (rewardTokens: TokenDto[]) =>
  rewardTokens.map((val, i) =>
    val.isPoints ? (
      <Box as="span" display="inline-block" key={tokenString(val)}>
        <Box
          display="inline-block"
          className={symbolIcon}
          as="img"
          src={val.logoURI}
          hw="5"
          marginRight="1"
        />

        {maybeAddComma({
          arrLength: rewardTokens.length,
          i,
          str: val.name.replace(/points/i, "").trim(),
        })}
      </Box>
    ) : (
      <React.Fragment key={tokenString(val)}>
        {maybeAddComma({
          arrLength: rewardTokens.length,
          i,
          str: val.symbol,
        })}
      </React.Fragment>
    )
  );

const maybeAddComma = ({
  arrLength,
  i,
  str,
}: { str: string; i: number; arrLength: number }) =>
  i !== arrLength - 1 ? <>{str},&nbsp;</> : str;
