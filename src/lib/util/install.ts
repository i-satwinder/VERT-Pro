import { browser } from "$app/environment";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
	return "prompt" in e && typeof (e as any).prompt === "function";
}

/**
 * Capture the beforeinstallprompt event.
 * Call this once during app initialization (e.g. in onMount).
 */
export function initInstallPrompt(): void {
	if (!browser || installed) return;

	window.addEventListener("beforeinstallprompt", (e: Event) => {
		e.preventDefault();
		if (isBeforeInstallPromptEvent(e)) {
			deferredPrompt = e;
			console.log("[Install] install prompt captured");
		}
	});

	window.addEventListener("appinstalled", () => {
		deferredPrompt = null;
		installed = true;
		console.log("[Install] app installed");
	});
}

/**
 * Returns true if the browser install prompt is available.
 */
export function canInstall(): boolean {
	return deferredPrompt !== null && !installed;
}

/**
 * Returns true if the app was already installed.
 */
export function isInstalled(): boolean {
	return installed;
}

/**
 * Trigger the native browser install prompt.
 * Returns the user's choice outcome or null if not available.
 */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
	if (!deferredPrompt) {
		console.warn("[Install] no install prompt available");
		return null;
	}

	try {
		await deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		console.log(`[Install] user choice: ${outcome}`);
		deferredPrompt = null;
		return outcome;
	} catch (err) {
		console.error("[Install] prompt failed:", err);
		return null;
	}
}
