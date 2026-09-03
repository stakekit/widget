import { useAtomValue } from "@effect/atom-react";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type { WidgetConfig } from "../../../services/config/widget-config-model";
import { widgetConfigFieldAtom } from "../state/widget-config";

export const useWidgetConfig = <Field extends keyof WidgetConfig>(
  field: Field
): WidgetConfig[Field] =>
  useAtomValue(widgetConfigFieldAtom(field) as Atom.Atom<WidgetConfig[Field]>);
