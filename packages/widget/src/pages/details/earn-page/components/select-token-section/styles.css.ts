import { atoms } from "@sk-widget/styles/theme";
import { style } from "@vanilla-extract/css";

export const priceTxt = style({
  flexGrow: 999,
});

export const bottomBannerBottomRadius = style({
  borderBottomLeftRadius: 0,
  borderBottomRightRadius: 0,
});

export const bottomBanner = style([
  atoms({ borderRadius: "xl" }),
  {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    background:
      "linear-gradient(90deg, #4B2921 0%, #723426 25.78%, #994238 59.59%, #7C3C48 100%)",
  },
]);

export const bottomBannerText = style({
  fontSize: "12px",
});
