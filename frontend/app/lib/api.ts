const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const DEFAULT_API_URL = "http://127.0.0.1:8000";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiUrl() {
  let configuredUrl = trimTrailingSlash(process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL);

  if (typeof window !== "undefined") {
    const currentHost = window.location.hostname;
    const isProductionEnv = currentHost && (
      currentHost.includes("thtsolution.online") || 
      currentHost.includes("vercel.app")
    );
    const isLocalhostApi = configuredUrl.includes("localhost") || configuredUrl.includes("127.0.0.1");

    if (isProductionEnv && isLocalhostApi) {
      configuredUrl = "https://quochiepho-scanweb-api.hf.space";
    }
  }

  if (typeof window === "undefined") {
    return configuredUrl;
  }

  try {
    const url = new URL(configuredUrl);
    const currentHost = window.location.hostname;
    const isViewingFromLan = currentHost && !LOCAL_HOSTS.has(currentHost);
    const usesLoopbackApi = LOCAL_HOSTS.has(url.hostname);

    if (isViewingFromLan && usesLoopbackApi) {
      url.hostname = currentHost;
      return trimTrailingSlash(url.toString());
    }

    return trimTrailingSlash(url.toString());
  } catch {
    return configuredUrl;
  }
}
