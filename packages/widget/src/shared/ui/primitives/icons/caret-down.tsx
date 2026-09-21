import { vars } from "../../../styles/theme/contract.css";
import { Box } from "../box";
import { ContentLoaderSquare } from "../content-loader";

export const CaretDownIcon = ({
  size = 12,
  loading = false,
}: {
  size?: number;
  loading?: boolean;
}) =>
  loading ? (
    <Box
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      style={{ width: size, height: size }}
      flexShrink={0}
    >
      <ContentLoaderSquare />
    </Box>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M9.75 4.5L6 8.25L2.25 4.5"
        stroke={vars.color.text}
        strokeWidth="1.33333"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
