import { useEffect, useState } from "react";
import { rootSelector } from "../styles";
import { MaybeDocument } from "../utils/maybe-document";

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
