import { style } from "@vanilla-extract/css";
import { vars } from "../../../../../shared/styles/theme/contract.css";

export const utilaPendingApprovalsBanner = style({
  background: vars.color.warningBoxBackground,
  borderRadius: vars.borderRadius.baseContract.xl,
});

export const stepsErrorBanner = style({
  background: vars.color.errorBoxBackground,
  borderRadius: vars.borderRadius.baseContract.xl,
});
