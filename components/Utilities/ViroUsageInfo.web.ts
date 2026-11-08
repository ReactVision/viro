import type { ViroUsageInfo } from "./ViroUsagePing";

const INSTALL_ID_KEY = "com.reactvision.viro.installId";
const LOCAL_HOSTS = new Set(["", "localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

let pageInstallId: string | null = null;

function isLocalHost(hostname: string): boolean {
  return LOCAL_HOSTS.has(hostname) || hostname.endsWith(".local");
}

function installId(newId: () => string): string {
  let storage: Storage | undefined;
  try {
    storage = (globalThis as any).localStorage;
    const stored = storage?.getItem(INSTALL_ID_KEY);
    if (stored) return stored;
  } catch {
    storage = undefined;
  }
  // Storage can be blocked (private mode, sandboxed iframes); the id then lasts for the page load.
  if (!pageInstallId) pageInstallId = newId();
  try {
    storage?.setItem(INSTALL_ID_KEY, pageInstallId);
  } catch {}
  return pageInstallId;
}

function osFamily(userAgent: string, maxTouchPoints: number): string | null {
  if (/Windows/.test(userAgent)) return "Windows";
  if (/CrOS/.test(userAgent)) return "ChromeOS";
  if (/Android/.test(userAgent)) return "Android";
  if (/iPhone|iPad|iPod/.test(userAgent)) return "iOS";
  // iPadOS asks for the desktop site by default and reports itself as a Mac.
  if (/Macintosh|Mac OS X/.test(userAgent)) return maxTouchPoints > 1 ? "iOS" : "macOS";
  if (/Linux/.test(userAgent)) return "Linux";
  return null;
}

function browserFamily(userAgent: string): string {
  if (/Edg(e|A|iOS)?\//.test(userAgent)) return "edge";
  // Chromium browsers that also say "Chrome/" but are not Chrome.
  if (/OPR\/|SamsungBrowser\//.test(userAgent)) return "other";
  if (/Firefox\/|FxiOS\//.test(userAgent)) return "firefox";
  if (/Chrome\/|CriOS\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent)) return "safari";
  return "other";
}

// Null skips the ping: a page served from the developer's own machine is not an install.
export async function readUsageInfo(
  newId: () => string
): Promise<ViroUsageInfo | null> {
  const hostname = String((globalThis as any).location?.hostname ?? "").toLowerCase();
  if (isLocalHost(hostname)) return null;
  const nav = (globalThis as any).navigator;
  const userAgent = typeof nav?.userAgent === "string" ? nav.userAgent : "";
  return {
    install_id: installId(newId),
    app_id: hostname,
    platform: "web",
    os_version: osFamily(userAgent, Number(nav?.maxTouchPoints) || 0),
    device_model: null,
    app_version: null,
    app_build: null,
    rn_version: null,
    has_rv_credentials: null,
    rv_project_id: null,
    features: { browser: browserFamily(userAgent) },
  };
}
