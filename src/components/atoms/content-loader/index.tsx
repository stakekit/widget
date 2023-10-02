import ContentLoader from "react-content-loader";

export const ContentLoaderSquare = ({ heightPx }: { heightPx: number }) => {
  return (
    <ContentLoader
      speed={2.5}
      width="100%"
      height={`${heightPx}px`}
      backgroundColor="#363636"
      foregroundColor="#2B2B2B"
    >
      <rect x="0" y="0" rx="12" ry="12" width="100%" height="100%" />
    </ContentLoader>
  );
};
