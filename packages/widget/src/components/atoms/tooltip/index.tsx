import * as Tooltip from "@radix-ui/react-tooltip";
import type { PropsWithChildren, ReactNode } from "react";
import { id } from "../../../styles/theme/ids";
import { Text } from "../typography/text";
import { tooltipContent, triggerWrapper } from "./style.css";

export const ToolTip = ({
  children,
  label,
  maxWidth = 200,
  textAlign = "center",
  asChild,
}: PropsWithChildren<{
  label: string | ReactNode;
  maxWidth?: number;
  textAlign?: "center" | "left" | "right" | "end";
  asChild?: boolean;
}>) => (
  <Tooltip.Provider>
    <Tooltip.Root delayDuration={0}>
      <Tooltip.Trigger className={triggerWrapper} asChild={asChild}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          className={tooltipContent}
          style={{ maxWidth }}
          sideOffset={5}
          data-rk={id}
        >
          {typeof label === "string" ? (
            <Text textAlign={textAlign} variant={{ type: "white" }}>
              {label}
            </Text>
          ) : (
            label
          )}
          <Tooltip.Arrow />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);
