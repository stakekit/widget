import { vars } from "../../../styles/theme/contract.css";

export const Check = ({
  color,
  hw = 24,
  className,
}: {
  hw?: number;
  color?: Exclude<keyof (typeof vars)["color"], "connectKit">;
  className?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={hw}
    height={hw}
    fill={color ? vars.color[color] : vars.color.textMuted}
    viewBox="0 0 256 256"
    className={className}
  >
    <path d="m232.49 80.49-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183 215.51 63.51a12 12 0 0 1 17 17Z" />
  </svg>
);
