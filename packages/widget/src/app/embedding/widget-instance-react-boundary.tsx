import {
  Fragment,
  type PropsWithChildren,
  useCallback,
  useRef,
  useState,
} from "react";
import { acquireWidgetInstanceClaim } from "./widget-instance-claim";

/**
 * ADR-0004 allowlisted React lifecycle boundary. The non-rendering template
 * discovers the actual mounting document before application providers render.
 */
export const WidgetInstanceReactBoundary = ({
  children,
}: PropsWithChildren) => {
  const [claimAcquired, setClaimAcquired] = useState(false);
  const releaseClaimRef = useRef<(() => void) | null>(null);

  const claimBoundaryRef = useCallback(
    (element: HTMLTemplateElement | null) => {
      if (element) {
        releaseClaimRef.current = acquireWidgetInstanceClaim(
          element.ownerDocument
        );
        setClaimAcquired(true);
        return;
      }

      releaseClaimRef.current?.();
      releaseClaimRef.current = null;
    },
    []
  );

  return (
    <>
      {claimAcquired ? (
        <Fragment key="widget-instance-content">{children}</Fragment>
      ) : null}
      <template
        data-sk-widget-instance-boundary=""
        key="widget-instance-claim"
        ref={claimBoundaryRef}
      />
    </>
  );
};
