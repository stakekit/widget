import { ContentLoaderSquare } from "../../primitives/content-loader";

export const LoadingSkeleton = () => (
  <div aria-busy="true">
    <ContentLoaderSquare heightPx={320} />
  </div>
);
