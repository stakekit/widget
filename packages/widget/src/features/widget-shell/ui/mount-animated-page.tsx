import { type PropsWithChildren, type ReactElement, useState } from "react";
import { Entrance } from "../../../ui/index";
import { useMountAnimation } from "../../mount-animation/index";
import { PageContainer } from "./page-container";

/**
 * A tab page that drops in as it mounts: slowly after the frame opens on the
 * Widget's first mount, briefly after that.
 */
export const MountAnimatedPage = ({
  children,
}: PropsWithChildren): ReactElement => {
  const { mountAnimationFinished } = useMountAnimation();
  const [stage] = useState<"first" | "later">(() =>
    mountAnimationFinished ? "later" : "first"
  );

  return (
    <Entrance stage={stage}>
      <PageContainer>{children}</PageContainer>
    </Entrance>
  );
};
