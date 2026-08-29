import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

/**
 * In-app replacement for window.confirm() — native browser confirm dialogs
 * can't be styled and look jarring against the app's UI. confirm() resolves
 * true/false like window.confirm did, so call sites just add `await`.
 */
export const useConfirmDialog = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((msg: string) => {
    setMessage(msg);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = (value: boolean) => {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  };

  const ConfirmDialog = (
    <AlertDialog open={open} onOpenChange={(o) => !o && settle(false)}>
      <AlertDialogContent className="max-w-sm rounded-2xl border-2 border-[hsl(var(--nb-border))] bg-background shadow-[6px_6px_0_0_hsl(var(--nb-border))] p-5">
        <AlertDialogDescription className="text-[15px] font-medium text-foreground text-center">
          {message}
        </AlertDialogDescription>
        <AlertDialogFooter className="mt-4 flex-row justify-center gap-2 sm:justify-center sm:space-x-0">
          <Button variant="outline" size="sm" onClick={() => settle(false)}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => settle(true)}>
            {isAr ? "تأكيد" : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, ConfirmDialog };
};
