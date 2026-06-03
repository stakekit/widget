import { vars } from "../../../styles/theme/contract.css";

export const ArrowUpIcon = ({
  size = 16,
  color,
}: {
  size?: number;
  color?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M8 13V3M8 3L3.5 7.5M8 3l4.5 4.5"
      stroke={color ?? vars.color.text}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
