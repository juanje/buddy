import type { LocaleStrings } from "./es";

export const en: LocaleStrings = {
  inputPlaceholder: "Write a message…",
  connectionLost: "Lost connection to the assistant",
  restart: "Restart",
  sendTitle: "Send (Enter)",
  abortTitle: "Abort (Esc)",
  scrollToBottom: "Scroll to bottom",
  wizardTitle: "Welcome to Buddy",
  wizardIntro:
    "Let's set up your personal assistant. It will live in a folder on your computer, with its own memory and notes.",
  personalizationTitle: "Tell your assistant a bit about you",
  personalizationNameLabel: "How should your assistant address you?",
  personalizationNameHint: "Your name or what you prefer to be called",
  personalizationAboutLabel: "Tell your assistant about yourself",
  personalizationAboutHint:
    "The more you share, the more useful it is from day one — work, interests, what you'll use it for…",
  gitRequired:
    "Buddy needs git to store your assistant's memory safely. We couldn't find it on your system.",
  gitCheckRetry: "Check again",
  gitChecking: "Checking…",
  wizardContinue: "Continue",
  wizardBack: "Back",
  locationTitle: "Where will your assistant live?",
  locationHint:
    "It's a normal folder on your computer. It will store its memory, your notes, and everything it learns.",
  locationNotEmpty: "That folder already has files. Choose an empty folder or one that doesn't exist yet.",
  locationNotADirectory: "That path is not a folder.",
  locationExistingAb: "That folder already contains a Buddy assistant.",
  locationImport: "Import this assistant",
  providerTitle: "Connect your AI provider",
  providerHint:
    "Your assistant needs an AI service to think. Sign in with your account or use an API key.",
  providerAnthropic: "Anthropic (Claude)",
  providerOpenai: "OpenAI (GPT)",
  providerGoogle: "Google (Gemini)",
  providerCustom: "OpenAI-compatible (local or other)",
  apiKeyLabel: "API key",
  baseUrlLabel: "Service URL",
  apiKeyValidate: "Validate and continue",
  apiKeyValidating: "Validating…",
  modelTitle: "Choose your assistant's brain",
  modelHint: "You can change this later. When in doubt, stick with the recommended one.",
  modelRecommended: "Recommended",
  modelCustomLabel: "Model identifier",
  modelCustomHint: "Enter the model name exactly as your service exposes it.",
  permissionTitleOutside: "The assistant wants to access a file outside its folder",
  permissionTitleIdentity: "The assistant wants to update its personality",
  permissionOpRead: "Read",
  permissionOpWrite: "Write",
  permissionAllowOnce: "Allow once",
  permissionDeny: "Don't allow",
  permissionAllowed: "Allowed",
  permissionDenied: "Denied",
  creatingTitle: "Preparing your assistant…",
  creatingHint: "Creating its memory and getting everything ready. This will only take a moment.",
  creatingError: "Setup could not be completed",
  creatingRetry: "Retry",
  attachTitle: "Attach file",
  dropOverlay: "Drop file here",
  unsupportedFormat: "Unsupported format — export to text (.md or .txt)",
  thinkingShow: "Thinking…",
  thinkingHide: "Hide thinking",
  toolReading: "Reading…",
  toolReadingFile: "Reading {file}",
  toolWriting: "Writing…",
  toolWritingFile: "Writing {file}",
  toolSearching: "Searching…",
  toolListing: "Listing files…",
  toolRunning: "Running {tool}…",
  toolWorking: "Working…",
  toolReadCount: "Read {count} files",
  toolWriteCount: "Wrote {count} files",
  toolUsedCount: "Used {count} tools",
  welcomeGreeting: "What can I help you with?",
  welcomeDeferredHeading: "You have {count} items due today",
  welcomeDueToday: "due",
  welcomeOverdue: "overdue",
  welcomeDismiss: "Dismiss",
  welcomeRegion: "Welcome",
  oauthSignIn: "Sign in",
  oauthWaiting: "Waiting for browser…",
  oauthUseApiKey: "I have an API key",
  oauthBackToSignIn: "Back to sign in",
  oauthCancel: "Cancel",
  modelLoading: "Loading models…",
  headerEndSession: "End session",
  headerAbout: "About",
  aboutTitle: "About Buddy",
  aboutVersion: "Version",
  aboutDirectory: "Directory",
  aboutModel: "Model",
  aboutTurns: "Turns this session",
  aboutClose: "Close",
};

export function tierDescriptionEn(tier: "fast" | "balanced" | "powerful"): string {
  switch (tier) {
    case "fast":
      return "Fast and very affordable. Great for everyday use.";
    case "balanced":
      return "Good balance of capability and cost.";
    case "powerful":
      return "The most capable. Slower and more expensive.";
  }
}

export function gitInstallInstructionsEn(platform: string): string {
  switch (platform) {
    case "darwin":
      return "Install Apple's command line tools by running «xcode-select --install» in Terminal, or install git with Homebrew: «brew install git».";
    case "linux":
      return "Install git with your distribution's package manager: «sudo apt install git» (Debian/Ubuntu) or «sudo dnf install git» (Fedora).";
    case "win32":
      return "Download and install Git for Windows from https://git-scm.com/download/win and restart the app.";
    default:
      return "Download and install git from https://git-scm.com/downloads and restart the app.";
  }
}
