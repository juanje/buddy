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
  gitRequired:
    "AB necesita git para guardar la memoria de tu asistente de forma segura. No lo hemos encontrado en tu equipo.",
  gitCheckRetry: "Volver a comprobar",
  gitChecking: "Comprobando…",
  wizardContinue: "Continuar",
} as const;

/**
 * Platform-specific git install instructions (FR-SETUP-02). Keyed by Node's
 * process.platform reported by the worker; unknown platforms get the generic
 * download link.
 */
export function gitInstallInstructions(platform: string): string {
  switch (platform) {
    case "darwin":
      return "Instala las herramientas de línea de comandos de Apple ejecutando «xcode-select --install» en Terminal, o instala git con Homebrew: «brew install git».";
    case "linux":
      return "Instala git con el gestor de paquetes de tu distribución: «sudo apt install git» (Debian/Ubuntu) o «sudo dnf install git» (Fedora).";
    case "win32":
      return "Descarga e instala Git para Windows desde https://git-scm.com/download/win y reinicia la aplicación.";
    default:
      return "Descarga e instala git desde https://git-scm.com/downloads y reinicia la aplicación.";
  }
}
