// Keep completion UI inside the main app window for consistent cross-platform behavior.
export function shouldUseNativeCompletionOverlay(
  _platform: NodeJS.Platform = process.platform
) {
  return false;
}
