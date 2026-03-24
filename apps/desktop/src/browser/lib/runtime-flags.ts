type RuntimeFlagTransport = "hash" | "query";

type RuntimeFlagOptions = {
  mode?: "completion-overlay" | "main";
  nativeCompletionOverlayEnabled?: boolean;
  transport?: RuntimeFlagTransport;
};

function normalizeHashSearch(hash: string) {
  if (hash.startsWith("#?")) {
    return hash.slice(2);
  }

  if (hash.startsWith("#")) {
    return hash.slice(1);
  }

  return hash;
}

function getRuntimeFlagParams(search: string, hash = "") {
  const searchParams = new URLSearchParams(search);

  if (searchParams.size > 0) {
    return searchParams;
  }

  return new URLSearchParams(normalizeHashSearch(hash));
}

export function buildRuntimeFlagSuffix({
  mode = "main",
  nativeCompletionOverlayEnabled = true,
  transport = "query",
}: RuntimeFlagOptions = {}) {
  const params = new URLSearchParams();

  if (mode === "completion-overlay") {
    params.set("window", "completion-overlay");
  }

  if (!nativeCompletionOverlayEnabled) {
    params.set("native-completion-overlay", "0");
  }

  if (params.size === 0) {
    return "";
  }

  const serialized = params.toString();

  return transport === "hash" ? `#?${serialized}` : `?${serialized}`;
}

export function isCompletionOverlayWindow(search: string, hash = "") {
  return (
    getRuntimeFlagParams(search, hash).get("window") === "completion-overlay"
  );
}

export function isNativeCompletionOverlayEnabled(search: string, hash = "") {
  return (
    getRuntimeFlagParams(search, hash).get("native-completion-overlay") !== "0"
  );
}
