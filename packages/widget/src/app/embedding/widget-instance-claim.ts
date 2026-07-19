const widgetInstanceClaimKey = Symbol.for(
  "@stakekit/widget/widget-instance-claim"
);

const alreadyMountedMessage =
  "Only one StakeKit Widget may be mounted in a browser document at a time.";

class StakeKitWidgetInstanceAlreadyMountedError extends Error {
  override readonly name = "StakeKitWidgetInstanceAlreadyMountedError";

  constructor() {
    super(alreadyMountedMessage);
  }
}

export const acquireWidgetInstanceClaim = (
  browserDocument: Document
): (() => void) => {
  if (Reflect.has(browserDocument, widgetInstanceClaimKey)) {
    throw new StakeKitWidgetInstanceAlreadyMountedError();
  }

  const claimOwnerToken = {};
  Reflect.set(browserDocument, widgetInstanceClaimKey, claimOwnerToken);

  return () => {
    if (
      Reflect.get(browserDocument, widgetInstanceClaimKey) === claimOwnerToken
    ) {
      Reflect.deleteProperty(browserDocument, widgetInstanceClaimKey);
    }
  };
};
