"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConfirmationVariant = "default" | "destructive";

type ConfirmationOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  requireText?: string;
  requireTextPlaceholder?: string;
};

type ConfirmationDialogState = ConfirmationOptions & {
  mode: "confirm" | "alert";
  resolve: (confirmed: boolean) => void;
};

type ConfirmationContextValue = {
  confirm: (options: ConfirmationOptions | string) => Promise<boolean>;
  alert: (options: ConfirmationOptions | string) => Promise<void>;
};

const ConfirmationContext = createContext<ConfirmationContextValue | null>(
  null,
);

function normalizeOptions(
  options: ConfirmationOptions | string,
  mode: "confirm" | "alert",
): ConfirmationOptions {
  if (typeof options === "string") {
    return {
      title: mode === "confirm" ? "Please Confirm" : "Notice",
      description: options,
    };
  }

  return options;
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] =
    useState<ConfirmationDialogState | null>(null);
  const [typedConfirmation, setTypedConfirmation] = useState("");

  const closeDialog = useCallback((confirmed: boolean) => {
    setTypedConfirmation("");
    setDialogState((current) => {
      if (!current) {
        return null;
      }

      current.resolve(confirmed);
      return null;
    });
  }, []);

  const confirm = useCallback((options: ConfirmationOptions | string) => {
    const normalized = normalizeOptions(options, "confirm");

    return new Promise<boolean>((resolve) => {
      setTypedConfirmation("");
      setDialogState({
        mode: "confirm",
        title: normalized.title || "Please Confirm",
        description: normalized.description,
        confirmText: normalized.confirmText || "Confirm",
        cancelText: normalized.cancelText || "Cancel",
        variant: normalized.variant || "default",
        requireText: normalized.requireText,
        requireTextPlaceholder: normalized.requireTextPlaceholder,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: ConfirmationOptions | string) => {
    const normalized = normalizeOptions(options, "alert");

    return new Promise<void>((resolve) => {
      setTypedConfirmation("");
      setDialogState({
        mode: "alert",
        title: normalized.title || "Notice",
        description: normalized.description,
        confirmText: normalized.confirmText || "OK",
        variant: normalized.variant || "default",
        resolve: () => resolve(),
      });
    });
  }, []);

  const value = useMemo(
    () => ({
      confirm,
      alert,
    }),
    [alert, confirm],
  );

  const requiresTypedConfirmation =
    dialogState?.mode === "confirm" && Boolean(dialogState.requireText);
  const typedConfirmationMatches =
    !requiresTypedConfirmation ||
    typedConfirmation.trim().toUpperCase() ===
      String(dialogState?.requireText).toUpperCase();

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(dialogState)}
        onOpenChange={(open) => {
          if (!open) {
            closeDialog(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogState?.title}</DialogTitle>
            {dialogState?.description ? (
              <DialogDescription>{dialogState.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          {requiresTypedConfirmation ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Type <strong>{dialogState?.requireText}</strong> to confirm.
              </p>
              <Input
                value={typedConfirmation}
                onChange={(event) => setTypedConfirmation(event.target.value)}
                placeholder={
                  dialogState?.requireTextPlaceholder || "Type to confirm"
                }
                autoFocus
              />
            </div>
          ) : null}
          <DialogFooter>
            {dialogState?.mode === "confirm" ? (
              <Button
                variant="outline"
                onClick={() => {
                  closeDialog(false);
                }}
              >
                {dialogState.cancelText || "Cancel"}
              </Button>
            ) : null}
            <Button
              variant={
                dialogState?.variant === "destructive"
                  ? "destructive"
                  : "default"
              }
              disabled={
                dialogState?.mode === "confirm" && !typedConfirmationMatches
              }
              onClick={() => {
                closeDialog(true);
              }}
            >
              {dialogState?.confirmText || "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirmation must be used inside ConfirmationProvider");
  }

  return context;
}
