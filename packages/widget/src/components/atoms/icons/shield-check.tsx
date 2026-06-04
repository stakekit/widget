import { vars } from "../../../styles/theme/contract.css";

export const ShieldCheckIcon = ({
  width,
  height,
  color = "text",
}: {
  width?: number;
  height?: number;
  color?: Exclude<keyof (typeof vars)["color"], "connectKit">;
}) => (
  <svg
    width={width ?? 48}
    height={height ?? 48}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
  >
    <path
      d="M12 2 4 5v6c0 5 3.4 8.27 8 10 4.6-1.73 8-5 8-10V5l-8-3Z"
      stroke={vars.color[color]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m8.75 12 2.25 2.25L15.5 9.75"
      stroke={vars.color[color]}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
