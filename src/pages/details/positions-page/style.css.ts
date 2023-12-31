import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles";

export const claimRewardsContainer = style([
  atoms({
    background: "positionsClaimRewardsBackground",
    borderRadius: "base",
  }),
  {
    padding: "2px 6px",
  },
]);

export const viaText = style({
  textOverflow: "ellipsis",
  overflow: "hidden",
  whiteSpace: "nowrap",
  width: "100%",
});
