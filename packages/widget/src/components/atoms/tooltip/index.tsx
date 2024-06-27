import * as Tooltip from "@radix-ui/react-tooltip";
import { Text } from "@sk-widget/components";
import { useRootElement } from "@sk-widget/providers/root-element";
import type { PropsWithChildren } from "react";
import { tooltipContent } from "./style.css";

export const ToolTip = ({
  children,
  label,
  maxWidth = 200,
  textAlign = "center",
}: PropsWithChildren<{
  label: string;
  maxWidth?: number;
  textAlign?: "center" | "left" | "right" | "end";
}>) => (
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal container={useRootElement()}>
        <Tooltip.Content
          className={tooltipContent}
          style={{ maxWidth }}
          sideOffset={5}
        >
          <Text textAlign={textAlign} variant={{ type: "white" }}>
            {label}
          </Text>
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);
