// Explicit event bus for language transition overlay.
// Only LangToggle calls trigger() — this avoids i18n's internal
// languageChanged events that fire on init and cause false triggers.
type Listener = () => void;
const listeners = new Set<Listener>();

export const onLangTransition = (fn: Listener): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const triggerLangTransition = () => listeners.forEach(fn => fn());
