import ContentLoader from "react-content-loader";

export const ContentLoaderSquare = ({
  heightPx,
  rXY = "12",
  uniqueKey,
}: {
  heightPx: number;
  rXY?: string;
  uniqueKey: string;
}) => {
  return (
    <ContentLoader
      speed={2.5}
      width="100%"
      height={`${heightPx}px`}
      backgroundColor="#363636"
      foregroundColor="#2B2B2B"
      uniqueKey={uniqueKey}
    >
      <rect x="0" y="0" rx={rXY} ry={rXY} width="100%" height="100%" />
    </ContentLoader>
  );
};
