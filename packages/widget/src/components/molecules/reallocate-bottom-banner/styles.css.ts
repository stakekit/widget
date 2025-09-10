import { style } from "@vanilla-extract/css";
import { atoms } from "../../../styles/theme/atoms.css";
import { vars } from "../../../styles/theme/contract.css";

export const bottomBanner = style([
  atoms({ borderRadius: "xl" }),
  {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    background:
      "linear-gradient(90deg, #166534 0%, #16A34A 25.78%, #22C55E 59.59%, #14532D 100%)",
  },
]);

export const bottomBannerText = style({
  fontSize: "12px",
  color: vars.color.white,
});
