import { useAtomValue } from "@effect/atom-react";

import { widgetConfigFieldAtom } from "../../../runtime/widget-config";
import type { WidgetConfig } from "../../../services/config/widget-config-model";

export const useWidgetConfig = <Field extends keyof WidgetConfig>(
  field: Field
): WidgetConfig[Field] => useAtomValue(widgetConfigFieldAtom(field));
