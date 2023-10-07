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
import { Divider } from "../divider";
import { useSavedRef } from "../../../hooks";
import { useRootElement } from "../../../hooks/use-root-element";
import { ListItem } from "../list/list-item";
import { Spinner } from "../spinner";

export type SelectModalProps = PropsWithChildren<{
  title?: string;
  inputPlaceholder?: string;
  onSearch?: (value: string) => void;
  trigger: ReactNode;
  onClose?: () => void;
  forceOpen?: boolean;
  isLoading?: boolean;
  errorMessage?: string;
}>;

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
      inputPlaceholder,
      onClose,
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

    useEffect(() => {
      if (!open) {
        onCloseRef.current?.();
      }
    }, [onCloseRef, open]);

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
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          onSearch(e.target.value)
                        }
                      />
                    </Box>
                  )}

                  {showTopBar && (
                    <Box marginTop="2">
                      <Divider />
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
}: PropsWithChildren<{ onItemClick?: () => void; testId?: string }>) => {
  const { closeModal } = useSelectModalContext();

  const onClick = () => {
    if (onItemClick) {
      closeModal();
      onItemClick?.();
    }
  };

  return <ListItem onClick={onClick}>{children}</ListItem>;
};
