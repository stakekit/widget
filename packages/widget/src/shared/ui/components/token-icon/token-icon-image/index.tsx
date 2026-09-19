import type { Atoms } from "../../../../styles/theme/atoms.css";
import { Box } from "../../../primitives/box";
import { ContentLoaderCircle } from "../../../primitives/content-loader";
import { Image } from "../../../primitives/image";

type TokenIconProps = {
  tokenLogoHw?: Atoms["hw"];
} & (
  | {
      loading: true;
      mainUrl?: never;
      fallbackUrl?: never;
      name?: never;
    }
  | {
      loading?: false;
      mainUrl?: string;
      fallbackUrl?: string;
      name: string;
    }
);

export const TokenIconImage = ({
  mainUrl,
  fallbackUrl,
  name,
  loading,
  tokenLogoHw = "9",
}: TokenIconProps) =>
  loading ? (
    <Box hw={tokenLogoHw} data-rk="token-logo">
      <ContentLoaderCircle />
    </Box>
  ) : (
    <Image
      data-rk="token-logo"
      wrapperProps={{ hw: tokenLogoHw, "data-rk": "token-logo" }}
      imgProps={{ hw: "full" }}
      src={mainUrl ?? fallbackUrl}
      fallbackName={name}
    />
  );
