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
  locationTitle: "¿Dónde vivirá tu asistente?",
  locationHint:
    "Es una carpeta normal de tu equipo. Ahí guardará su memoria, tus notas y todo lo que aprenda.",
  locationNotEmpty: "Esa carpeta ya contiene archivos. Elige una carpeta vacía o una que no exista.",
  locationNotADirectory: "Esa ruta no es una carpeta.",
  locationExistingAb:
    "Esa carpeta ya contiene un asistente AB. La importación llegará en una próxima versión.",
  providerTitle: "Conecta tu proveedor de IA",
  providerHint:
    "Tu asistente necesita un servicio de IA para pensar. Elige el tuyo e introduce tu clave de API.",
  providerAnthropic: "Anthropic (Claude)",
  providerOpenai: "OpenAI (GPT)",
  providerGoogle: "Google (Gemini)",
  providerCustom: "Compatible con OpenAI (local u otro)",
  apiKeyLabel: "Clave de API",
  baseUrlLabel: "URL del servicio",
  apiKeyValidate: "Validar y continuar",
  apiKeyValidating: "Validando…",
  modelTitle: "Elige el cerebro de tu asistente",
  modelHint: "Puedes cambiarlo más adelante. Si dudas, quédate con el recomendado.",
  modelRecommended: "Recomendado",
  modelCustomLabel: "Identificador del modelo",
  modelCustomHint: "Escribe el nombre del modelo tal y como lo expone tu servicio.",
  creatingTitle: "Preparando tu asistente…",
  creatingHint: "Estamos creando su memoria y dejándolo todo listo. Solo tardará un momento.",
  creatingError: "No se pudo completar la configuración",
  creatingRetry: "Reintentar",
} as const;

/** Short cost/capability description per model tier (FR-SETUP-05). */
export function tierDescription(tier: "fast" | "balanced" | "powerful"): string {
  switch (tier) {
    case "fast":
      return "Rápido y muy económico. Ideal para el día a día.";
    case "balanced":
      return "Buen equilibrio entre capacidad y coste.";
    case "powerful":
      return "El más capaz. Más lento y más caro.";
  }
}

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
