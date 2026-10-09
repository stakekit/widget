import { vars } from "../../../styles/theme/contract.css";

export type XIconProps = {
  color?: keyof (typeof vars)["color"];
  hw?: number;
  strokeWidth?: number;
  rotation?: number;
};

export const XIcon = (props: XIconProps) => (
  <svg
    viewBox="0 0 24 24"
    width={props.hw ?? 24}
    height={props.hw ?? 24}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    transform={
      props.rotation === undefined ? undefined : `rotate(${props.rotation})`
    }
  >
    <path
      d="m18.75 5.25-13.5 13.5M18.75 18.75 5.25 5.25"
      stroke={props.color ? vars.color[props.color] : vars.color.textMuted}
      strokeWidth={props.strokeWidth ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
