// src/lib/i18n.ts — UI strings (v1: Spanish default for target user).
// Replace with locale-aware lookup when multi-language ships.

export const t = {
  inputPlaceholder: "Escribe un mensaje…",
  connectionLost: "Se perdió la conexión con el asistente",
  restart: "Reiniciar",
  sendTitle: "Send (Enter)",
  abortTitle: "Abort (Esc)",
  scrollToBottom: "Scroll to bottom",
  wizardTitle: "Bienvenido a AB",
  wizardIntro:
    "Vamos a preparar tu asistente personal. Este asistente vivirá en una carpeta de tu equipo, con su memoria y sus notas.",
  wizardComingSoon: "Los pasos del asistente de configuración llegarán en las próximas versiones.",
} as const;
