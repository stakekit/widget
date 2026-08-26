import type { ReactNode } from "react";
import type { HostVariant, SettingsProps } from "./types";

type NonZerionVariant = Exclude<HostVariant, "zerion">;

export type VariantProps =
  | Readonly<{
      variant: "zerion";
      chainModal: (args: {
        selectedChainId: number;
        chainIds: number[];
        onSwitchChain: (chainId: number) => void;
      }) => ReactNode;
    }>
  | {
      [Variant in NonZerionVariant]: Readonly<{ variant: Variant }>;
    }[NonZerionVariant];

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

export type HelpModalProps = {
  modal:
    | {
        type: "geoBlock";
        onClose: () => void;
        tags: Set<string>;
        countryCode: string;
        regionCode?: string;
        regionCodeName: string | undefined;
      }
    | { type: "getInTouch" }
    | { type: "whatIsStakeKit" };
  customTrigger?: ReactNode;
};
