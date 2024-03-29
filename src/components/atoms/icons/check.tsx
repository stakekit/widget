import { vars } from "../../../styles";

export const Check = ({
  color,
}: {
  color?: Exclude<keyof (typeof vars)["color"], "connectKit">;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={24}
    height={24}
    fill={color ? vars.color[color] : vars.color.textMuted}
    viewBox="0 0 256 256"
  >
    <path d="m232.49 80.49-128 128a12 12 0 0 1-17 0l-56-56a12 12 0 1 1 17-17L96 183 215.51 63.51a12 12 0 0 1 17 17Z" />
  </svg>
);
