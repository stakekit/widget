import { Content, Overlay, Portal, Root, Title } from "@radix-ui/react-dialog";
import { Root as VisuallyHiddenRoot } from "@radix-ui/react-visually-hidden";
import { id } from "@sk-widget/styles/theme/ids";
import type { ChangeEvent, PropsWithChildren, ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSavedRef } from "../../../hooks";
import { Box } from "../box";
import { SearchIcon, XIcon } from "../icons";
import { ListItem } from "../list/list-item";
import type { ItemContainerVariants } from "../list/styles.css";
import { Spinner } from "../spinner";
import { Text } from "../typography";
import {
  container,
  content,
  noOutline,
  overlay,
  selectModalItemContainer,
} from "./styles.css";

type SelectModalWithoutStateProps = PropsWithChildren<
  {
    title?: string;
    inputPlaceholder?: string;
    trigger?: ReactNode;
    onClose?: () => void;
    onOpen?: () => void;
    searchValue?: string;
    isLoading?: boolean;
    errorMessage?: string;
    disableClose?: boolean;
    hideTopBar?: boolean;
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

type SelectModalContextType = {
  isOpen: boolean;
  setOpen: (val: boolean) => void;
};

export type SelectModalProps = SelectModalWithoutStateProps & {
  state?: SelectModalContextType;
};

const SelectModalContext = createContext<SelectModalContextType | undefined>(
  undefined
);

const useSelectModalContext = () => {
  const value = useContext(SelectModalContext);

  if (!value) {
    throw new Error("SelectModalContext is not provided");
  }

  return value;
};

const SelectModalWithoutState = ({
  children,
  trigger,
  title,
  onSearch,
  searchValue,
  inputPlaceholder,
  onClose,
  onOpen,
  isLoading,
  errorMessage,
  disableClose,
  hideTopBar,
}: SelectModalProps) => {
  const { isOpen, setOpen } = useSelectModalContext();

  const onCloseRef = useSavedRef(onClose);
  const onOpenRef = useSavedRef(onOpen);

  useEffect(() => {
    if (!isOpen) {
      onCloseRef.current?.();
    } else {
      onOpenRef.current?.();
    }
  }, [isOpen, onCloseRef, onOpenRef]);

  const showTopBar = !!title || !hideTopBar || onSearch;

  return (
    <Root open={isOpen} onOpenChange={setOpen}>
      {trigger}

      <Portal>
        <Box className={container} data-select-modal data-rk={id}>
          <Overlay onClick={() => setOpen(false)} className={overlay} />

          <Content
            data-testid="select-modal__container"
            className={content}
            aria-describedby={undefined}
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
                    {title ? (
                      <Title>
                        <Text
                          data-testid="select-modal__title"
                          variant={{ weight: "bold", size: "large" }}
                        >
                          {title}
                        </Text>
                      </Title>
                    ) : (
                      <VisuallyHiddenRoot asChild>
                        <Title>Selection Modal</Title>
                      </VisuallyHiddenRoot>
                    )}

                    {isLoading && <Spinner />}
                  </Box>
                  {!disableClose && (
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
  );
};

export const SelectModal = ({ state, ...props }: SelectModalProps) => {
  const [isOpen, setOpen] = useState(false);

  const value = useMemo<SelectModalContextType>(
    () =>
      state ?? {
        isOpen,
        setOpen: (val) => setOpen(val),
      },
    [isOpen, state]
  );

  return (
    <SelectModalContext.Provider value={value}>
      <SelectModalWithoutState {...props} />
    </SelectModalContext.Provider>
  );
};

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
  onItemClick?: (args: { closeModal: () => void }) => void;
  testId?: string;
  variant?: ItemContainerVariants;
}>) => {
  const { setOpen } = useSelectModalContext();

  const onClick = () => onItemClick?.({ closeModal: () => setOpen(false) });

  return (
    <ListItem variant={variant} onClick={onClick} testId={testId}>
      {children}
    </ListItem>
  );
};
