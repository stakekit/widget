import type { ReactNode } from "react";
import type { SettingsProps, SKHostVariant } from "./types.js";

type NonZerionVariant = Exclude<SKHostVariant, "zerion">;

/**
 * One constituent per shape rather than per variant. Expanding the non-zerion
 * variants makes a widened `variant` match several constituents at once, which
 * defeats discrimination and drops editor property completions.
 */
export type VariantProps =
  | Readonly<{
      /** Zerion preset. Requires `chainModal`. */
      variant: "zerion";
      /** Renders the host's chain selector in place of the widget's. */
      chainModal: (args: {
        /** Chain the connected wallet is on. */
        selectedChainId: number;
        /** Chains the user can switch to. */
        chainIds: number[];
        /** Switches the connected wallet to `chainId`. */
        onSwitchChain: (chainId: number) => void;
      }) => ReactNode;
    }>
  | Readonly<{
      /** Host integration preset. Defaults to `"default"`. */
      variant: NonZerionVariant;
    }>;

/** Host Configuration passed into the Application Runtime (never React children). */
export type SKHostConfiguration = SettingsProps &
  (VariantProps | { variant?: never; chainModal?: never });

export type SKAppProps = SKHostConfiguration & {
  /**
   * Host chrome rendered beside the widget frame under the same Application
   * Runtime registry and translation service. Outside `AppContainer`, so
   * layout is not constrained by the widget chrome. `HelpModal` may be placed
   * here without an extra provider.
   */
  children?: ReactNode;
};

/**
 * Host-triggered help content. The geo-block notice is shown by the widget
 * itself and is not part of the host contract.
 */
export type HelpModalProps = {
  /** Help content to show. */
  modal: { type: "getInTouch" } | { type: "whatIsStakeKit" };
  /** Element that opens the modal. Defaults to a help icon. */
  customTrigger?: ReactNode;
};
