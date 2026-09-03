import { vars } from "../../../styles/theme/contract.css";

type ArrowDirection = "down" | "up" | "left" | "right";

const rotation: Record<ArrowDirection, number> = {
  down: 0,
  up: 180,
  left: 90,
  right: -90,
};

export const Arrow = ({
  size = 16,
  color,
  direction,
}: {
  size?: number;
  color?: string;
  direction: ArrowDirection;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    style={{
      transform: `rotate(${rotation[direction]}deg)`,
      transformOrigin: "center",
    }}
  >
    <path
      d="M8 3v10M8 13l-4.5-4.5M8 13l4.5-4.5"
      stroke={color ?? vars.color.text}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
