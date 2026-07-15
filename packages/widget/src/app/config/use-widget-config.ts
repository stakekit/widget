import { useAtomValue } from "@effect/atom-react";
import { type WidgetConfig, widgetConfigFieldAtom } from "./settings";

export const useWidgetConfig = <Field extends keyof WidgetConfig>(
  field: Field
): WidgetConfig[Field] => useAtomValue(widgetConfigFieldAtom(field));
