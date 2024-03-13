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
    if (rootElement) return;

    const observer = new MutationObserver((mutationList, observer) => {
      mutationList.forEach((mutation) => {
        if (mutation.type !== "childList") return;

        MaybeDocument.chainNullable(
          (doc) => doc.querySelector(rootSelector) as HTMLElement
        ).ifJust((el) => {
          setRootElement(el);
          observer.disconnect();
        });
      });
    });

    MaybeDocument.ifJust((doc) =>
      observer.observe(doc.body, { childList: true })
    );

    return () => {
      observer.disconnect();
    };
  }, [rootElement]);

  return rootElement;
};
