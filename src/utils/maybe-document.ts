import { MaybeWindow } from "./maybe-window";

export const MaybeDocument = MaybeWindow.chainNullable((w) => w.document);
