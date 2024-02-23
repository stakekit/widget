import { useEffect, useState } from "react";
import { MaybeDocument } from "../utils/maybe-document";
import { rootSelector } from "../styles";

export const useRootElement = () => {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(() =>
    MaybeDocument.map(
      (doc) => doc.querySelector(rootSelector) as HTMLElement
    ).extractNullable()
  );

  useEffect(() => {
    MaybeDocument.ifJust((doc) => {
      setRootElement(doc.querySelector(rootSelector) as HTMLElement);
    });
  }, []);

  return rootElement;
};
