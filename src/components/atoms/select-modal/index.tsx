import {
  ChangeEvent,
  createContext,
  forwardRef,
  PropsWithChildren,
  ReactNode,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Content, Overlay, Portal, Root } from "@radix-ui/react-alert-dialog";
import {
  container,
  content,
  noOutline,
  overlay,
  selectModalItemContainer,
} from "./styles.css";
import { Box } from "../box";
import { Text } from "../typography";
import { SearchIcon, XIcon } from "../icons";
import { useSavedRef } from "../../../hooks";
import { useRootElement } from "../../../hooks/use-root-element";
import { ListItem } from "../list/list-item";
import { Spinner } from "../spinner";
import { ItemContainerVariants } from "../list/styles.css";

export type SelectModalProps = PropsWithChildren<
  {
    title?: string;
    inputPlaceholder?: string;
    trigger: ReactNode;
    onClose?: () => void;
    onOpen?: () => void;
    searchValue?: string;
    forceOpen?: boolean;
    isLoading?: boolean;
    errorMessage?: string;
  } & (
    | {
        onSearch: (value: string) => void;
        searchValue: string;
      }
    | {
        onSearch?: never;
        searchValue?: never;
      }
  )
>;

export const SelectModalContext = createContext<
  { closeModal: () => void } | undefined
>(undefined);

const useSelectModalContext = () => {
  const value = useContext(SelectModalContext);

  if (!value) {
    throw new Error("SelectModalContext is not provided");
  }

  return value;
};

export const SelectModal = forwardRef<{ close: () => void }, SelectModalProps>(
  (
    {
      children,
      trigger,
      title,
      onSearch,
      searchValue,
      inputPlaceholder,
      onClose,
      onOpen,
      forceOpen,
      isLoading,
      errorMessage,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      close: () => setOpen(false),
    }));

    const value = useMemo(
      () => ({ closeModal: () => setOpen(false) }),
      [setOpen]
    );

    const onCloseRef = useSavedRef(onClose);
    const onOpenRef = useSavedRef(onOpen);

    useEffect(() => {
      if (!open) {
        onCloseRef.current?.();
      } else {
        onOpenRef.current?.();
      }
    }, [onCloseRef, onOpenRef, open]);

    const rootElement = useRootElement();

    const showTopBar = !!title || !forceOpen || onSearch;

    return (
      <SelectModalContext.Provider value={value}>
        <Root open={forceOpen || open} onOpenChange={setOpen}>
          {!forceOpen && trigger}

          <Portal container={rootElement}>
            <Box className={container}>
              <Overlay onClick={() => setOpen(false)} className={overlay} />

              <Content
                data-testid="select-modal__container"
                className={content}
              >
                <Box display="flex" flexDirection="column" height="full">
                  {showTopBar && (
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      px="4"
                    >
                      <Box flex={1} display="flex" alignItems="center" gap="2">
                        {title && (
                          <Text
                            data-testid="select-modal__title"
                            variant={{ weight: "bold", size: "large" }}
                          >
                            {title}
                          </Text>
                        )}

                        {isLoading && <Spinner />}
                      </Box>
                      {!forceOpen && (
                        <Box as="button" onClick={() => setOpen(false)}>
                          <XIcon />
                        </Box>
                      )}
                    </Box>
                  )}

                  {onSearch && (
                    <Box
                      display="flex"
                      mx="4"
                      my="2"
                      background="tokenSelectBackground"
                      borderRadius="xl"
                      alignItems="center"
                      as="label"
                    >
                      <Box mx="3" display="flex" alignItems="center">
                        <SearchIcon />
                      </Box>
                      <Box
                        data-testid="select-modal__search-input"
                        className={noOutline}
                        as="input"
                        border="none"
                        flex={1}
                        py="3"
                        borderRadius="xl"
                        color="text"
                        background="tokenSelectBackground"
                        placeholder={inputPlaceholder ?? ""}
                        value={searchValue}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          onSearch(e.target.value)
                        }
                      />
                    </Box>
                  )}

                  {!!errorMessage && (
                    <Box
                      display="flex"
                      justifyContent="center"
                      marginTop="4"
                      marginBottom="2"
                    >
                      <Text variant={{ type: "danger" }}>{errorMessage}</Text>
                    </Box>
                  )}

                  {children}
                </Box>
              </Content>
            </Box>
          </Portal>
        </Root>
      </SelectModalContext.Provider>
    );
  }
);

export const SelectModalItemContainer = ({ children }: PropsWithChildren) => (
  <Box mx="4" className={selectModalItemContainer}>
    {children}
  </Box>
);

export const SelectModalItem = ({
  children,
  onItemClick,
  testId,
  variant,
}: PropsWithChildren<{
  onItemClick?: () => void;
  testId?: string;
  variant?: ItemContainerVariants;
}>) => {
  const { closeModal } = useSelectModalContext();

  const onClick = () => {
    if (onItemClick) {
      closeModal();
      onItemClick?.();
    }
  };

  return (
    <ListItem variant={variant} onClick={onClick}>
      {children}
    </ListItem>
  );
};
