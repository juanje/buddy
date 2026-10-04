// src/lib/saved-notice.ts — the "saved" / "restart needed" notice shown by the
// integration panels after Save, shared so each panel keeps only its fields.

export type SavedNoticeState = "saved" | "restart" | false;

const SAVED_NOTICE_MS = 8000;

export interface SavedNotice {
  /** Hide the notice and cancel its auto-dismiss timer. */
  dismiss(): void;
  /** Run `onSave`, then show "restart" if the enabled toggle changed, else "saved". */
  save(onSave: () => void | Promise<void>): Promise<void>;
  /** Hide the notice and start a connection test (not awaited). */
  test(onTest: () => void | Promise<void>): void;
  /** A field was edited: the notice no longer describes what is on screen. */
  fieldInput(): void;
  /** The enabled checkbox changed: the next save needs a restart. */
  toggleEnabled(): void;
}

/** `onChange` receives every state transition; the panel keeps it in its own `$state`. */
export function createSavedNotice(
  onChange: (state: SavedNoticeState) => void,
  durationMs: number = SAVED_NOTICE_MS,
): SavedNotice {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let enabledToggled = false;

  function dismiss() {
    onChange(false);
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function show(enabledChanged: boolean) {
    dismiss();
    onChange(enabledChanged ? "restart" : "saved");
    timer = setTimeout(() => {
      onChange(false);
      timer = undefined;
    }, durationMs);
  }

  return {
    dismiss,
    async save(onSave) {
      dismiss();
      await onSave();
      show(enabledToggled);
      enabledToggled = false;
    },
    test(onTest) {
      dismiss();
      void onTest();
    },
    fieldInput: dismiss,
    toggleEnabled() {
      dismiss();
      enabledToggled = true;
    },
  };
}
