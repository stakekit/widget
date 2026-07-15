import React from "react";
import { tokenString } from "../../../../domain";
import type { AppToken } from "../../../../domain/schema/legacy-models";
import { Box } from "../../../../shared/ui/primitives/box";
import { symbolIcon } from "./style.css";

export const getRewardTokenSymbols = (rewardTokens: AppToken[]) =>
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
}: {
  str: string;
  i: number;
  arrLength: number;
}) => (i !== arrLength - 1 ? <>{str},&nbsp;</> : str);
