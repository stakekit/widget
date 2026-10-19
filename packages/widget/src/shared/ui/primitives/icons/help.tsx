import { vars } from "../../../styles/theme/contract.css";

export const HelpIcon = () => (
  <svg width={32} height={32} fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M16 25a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
      stroke={vars.color.textMuted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 22a1.125 1.125 0 1 0 0-2.25A1.125 1.125 0 0 0 16 22Z"
      fill={vars.color.textMuted}
    />
    <path
      d="M16 17.5v-.75a2.625 2.625 0 1 0-2.625-2.625"
      stroke={vars.color.textMuted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
