function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function getApiUrl() {
  return trimTrailingSlash("/api");
}
