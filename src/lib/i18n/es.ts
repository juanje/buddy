export type LocaleStrings = {
  inputPlaceholder: string;
  connectionLost: string;
  restart: string;
  sendTitle: string;
  abortTitle: string;
  scrollToBottom: string;
  typingIndicatorLabel: string;
  removeAttachmentTitle: string;
  permissionExpand: string;
  permissionDismiss: string;
  wizardTitle: string;
  wizardIntro: string;
  personalizationTitle: string;
  personalizationNameLabel: string;
  personalizationNameHint: string;
  personalizationAboutLabel: string;
  personalizationAboutHint: string;
  gitRequired: string;
  gitCheckRetry: string;
  gitChecking: string;
  wizardContinue: string;
  wizardBack: string;
  locationTitle: string;
  locationHint: string;
  locationNotEmpty: string;
  locationNotADirectory: string;
  locationExistingAb: string;
  locationImport: string;
  providerTitle: string;
  providerHint: string;
  providerAnthropic: string;
  providerOpenai: string;
  providerGoogle: string;
  providerCustom: string;
  apiKeyLabel: string;
  baseUrlLabel: string;
  apiKeyValidate: string;
  apiKeyValidating: string;
  modelTitle: string;
  modelHint: string;
  modelRecommended: string;
  modelCustomLabel: string;
  modelCustomHint: string;
  permissionTitleOutside: string;
  permissionTitleIdentity: string;
  permissionTitleDelete: string;
  permissionOpRead: string;
  permissionOpWrite: string;
  permissionOpDelete: string;
  permissionAllowOnce: string;
  permissionAllowAlwaysFile: string;
  permissionAllowAlwaysFolder: string;
  permissionDeny: string;
  permissionAllowed: string;
  permissionDenied: string;
  creatingTitle: string;
  creatingHint: string;
  creatingError: string;
  creatingRetry: string;
  attachTitle: string;
  dropOverlay: string;
  unsupportedFormat: string;
  thinkingShow: string;
  toolReading: string;
  toolReadingFile: string;
  toolWriting: string;
  toolWritingFile: string;
  toolSearching: string;
  toolListing: string;
  toolRunning: string;
  toolWorking: string;
  toolReadCount: string;
  toolWriteCount: string;
  toolUsedCount: string;
  welcomeGreeting: string;
  welcomeDeferredHeading: string;
  welcomeDueToday: string;
  welcomeOverdue: string;
  welcomeDismiss: string;
  deferredTypes: Record<string, string>;
  welcomeRegion: string;
  oauthSignIn: string;
  oauthWaiting: string;
  oauthUseApiKey: string;
  oauthBackToSignIn: string;
  oauthCancel: string;
  modelLoading: string;
  settingsTitle: string;
  settingsLanguage: string;
  settingsProvider: string;
  settingsModel: string;
  settingsDirectory: string;
  settingsVersion: string;
  settingsClose: string;
  settingsReadOnlyHint: string;
  settingsAddProvider: string;
  settingsProviderAdded: string;
  settingsGearTooltip: string;
  locationBrowse: string;
  locationBrowseTitle: string;
  settingsAuthRequired: string;
  settingsUsage: string;
  settingsUsageLoading: string;
  settingsUsageUnavailable: string;
  settingsSessionCost: string;
  settingsMonthlyCost: string;
  settingsMonthlyBudget: string;
  settingsBudgetDisabled: string;
  settingsDisableBudget: string;
  budgetBlockedMessage: string;
  budgetWarningTitle: string;
  budgetWarningBody: string;
  budgetExceededTitle: string;
  budgetExceededBody: string;
  notificationTitle: string;
  fileViewerClose: string;
  fileViewerOpenExternal: string;
  fileViewerLoading: string;
  fileViewerError: string;
};

export const es: LocaleStrings = {
  inputPlaceholder: "Escribe un mensaje…",
  connectionLost: "Se perdió la conexión con el asistente",
  restart: "Reiniciar",
  sendTitle: "Enviar (Enter)",
  abortTitle: "Cancelar (Esc)",
  scrollToBottom: "Ir al final",
  typingIndicatorLabel: "El asistente está escribiendo",
  removeAttachmentTitle: "Quitar",
  permissionExpand: "Expandir",
  permissionDismiss: "Cerrar",
  wizardTitle: "Bienvenido a Buddy",
  wizardIntro:
    "Vamos a preparar tu asistente personal. Este asistente vivirá en una carpeta de tu equipo, con su memoria y sus notas.",
  personalizationTitle: "Cuéntale un poco sobre ti",
  personalizationNameLabel: "¿Cómo quieres que te llame tu asistente?",
  personalizationNameHint: "Tu nombre o cómo prefieres que te llamen",
  personalizationAboutLabel: "Cuéntale sobre ti",
  personalizationAboutHint:
    "Cuanto más compartas, más útil será desde el primer día — trabajo, intereses, para qué lo usarás…",
  gitRequired:
    "Buddy necesita git para guardar la memoria de tu asistente de forma segura. No lo hemos encontrado en tu equipo.",
  gitCheckRetry: "Volver a comprobar",
  gitChecking: "Comprobando…",
  wizardContinue: "Continuar",
  wizardBack: "Atrás",
  locationTitle: "¿Dónde vivirá tu asistente?",
  locationHint:
    "Es una carpeta normal de tu equipo. Ahí guardará su memoria, tus notas y todo lo que aprenda.",
  locationNotEmpty: "Esa carpeta ya contiene archivos. Elige una carpeta vacía o una que no exista.",
  locationNotADirectory: "Esa ruta no es una carpeta.",
  locationExistingAb: "Esa carpeta ya contiene un asistente Buddy.",
  locationImport: "Importar este asistente",
  locationBrowse: "Explorar…",
  locationBrowseTitle: "Elige una carpeta",
  providerTitle: "Conecta tu proveedor de IA",
  providerHint:
    "Tu asistente necesita un servicio de IA para pensar. Inicia sesión con tu cuenta o usa una clave de API.",
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
  permissionTitleOutside: "El asistente quiere acceder a un archivo fuera de su carpeta",
  permissionTitleIdentity: "El asistente quiere actualizar su personalidad",
  permissionTitleDelete: "El asistente quiere eliminar un archivo",
  permissionOpRead: "Leer",
  permissionOpWrite: "Escribir",
  permissionOpDelete: "Eliminar",
  permissionAllowOnce: "Permitir una vez",
  permissionAllowAlwaysFile: "Permitir este archivo siempre",
  permissionAllowAlwaysFolder: "Permitir esta carpeta siempre",
  permissionDeny: "No permitir",
  permissionAllowed: "Permitido",
  permissionDenied: "Denegado",
  creatingTitle: "Preparando tu asistente…",
  creatingHint: "Estamos creando su memoria y dejándolo todo listo. Solo tardará un momento.",
  creatingError: "No se pudo completar la configuración",
  creatingRetry: "Reintentar",
  attachTitle: "Adjuntar archivo",
  dropOverlay: "Suelta el archivo aquí",
  unsupportedFormat: "Formato no compatible — exporta a texto (.md o .txt)",
  thinkingShow: "Pensando…",
  toolReading: "Leyendo…",
  toolReadingFile: "Leyendo {file}",
  toolWriting: "Escribiendo…",
  toolWritingFile: "Escribiendo {file}",
  toolSearching: "Buscando…",
  toolListing: "Listando archivos…",
  toolRunning: "Ejecutando {tool}…",
  toolWorking: "Trabajando…",
  toolReadCount: "Leyó {count} archivos",
  toolWriteCount: "Escribió {count} archivos",
  toolUsedCount: "Usó {count} herramientas",
  welcomeGreeting: "¿En qué puedo ayudarte?",
  welcomeDeferredHeading: "Tienes {count} elementos pendientes para hoy",
  welcomeDueToday: "hoy",
  welcomeOverdue: "vencido",
  welcomeDismiss: "Entendido",
  deferredTypes: { reminder: "recordatorio", decision: "decisión", info: "info", review: "revisión" },
  welcomeRegion: "Bienvenida",
  oauthSignIn: "Iniciar sesión",
  oauthWaiting: "Esperando al navegador…",
  oauthUseApiKey: "Tengo una clave de API",
  oauthBackToSignIn: "Volver a iniciar sesión",
  oauthCancel: "Cancelar",
  modelLoading: "Cargando modelos…",
  settingsTitle: "Ajustes",
  settingsLanguage: "Idioma",
  settingsProvider: "Proveedor de IA",
  settingsModel: "Modelo",
  settingsDirectory: "Carpeta de memoria",
  settingsVersion: "Versión",
  settingsClose: "Cerrar",
  settingsReadOnlyHint: "La carpeta de memoria se configura durante la instalación inicial.",
  settingsAddProvider: "Añadir proveedor",
  settingsProviderAdded: "Proveedor añadido — sus modelos ya están disponibles",
  settingsGearTooltip: "Ajustes",
  settingsAuthRequired: "Inicia sesión en {provider} para gestionar modelos",
  settingsUsage: "Uso",
  settingsUsageLoading: "Cargando uso…",
  settingsUsageUnavailable: "Datos de uso no disponibles",
  settingsSessionCost: "Esta sesión: ${amount}",
  settingsMonthlyCost: "Este mes: ${spent} / ${budget}",
  settingsMonthlyBudget: "Presupuesto mensual (USD)",
  settingsBudgetDisabled: "Sin límite",
  settingsDisableBudget: "Quitar límite de presupuesto",
  budgetBlockedMessage: "Presupuesto mensual alcanzado. Ajústalo en Ajustes para continuar.",
  budgetWarningTitle: "Buddy — aviso de presupuesto",
  budgetWarningBody: "Has usado ${spent} de tu presupuesto mensual de ${budget} (80%).",
  budgetExceededTitle: "Buddy — presupuesto alcanzado",
  budgetExceededBody: "Presupuesto mensual alcanzado (${spent} de ${budget}). El chat está pausado hasta que ajustes el presupuesto o empiece el mes.",
  notificationTitle: "buddy",
  fileViewerClose: "Cerrar",
  fileViewerOpenExternal: "Abrir externamente",
  fileViewerLoading: "Cargando archivo…",
  fileViewerError: "No se pudo leer el archivo: {message}",
};

/** Short cost/capability description per model tier (FR-SETUP-05). */
export function tierDescriptionEs(tier: "fast" | "balanced" | "powerful"): string {
  switch (tier) {
    case "fast":
      return "Rápido y muy económico. Ideal para el día a día.";
    case "balanced":
      return "Buen equilibrio entre capacidad y coste.";
    case "powerful":
      return "El más capaz. Más lento y más caro.";
  }
}

export function gitInstallInstructionsEs(platform: string): string {
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
