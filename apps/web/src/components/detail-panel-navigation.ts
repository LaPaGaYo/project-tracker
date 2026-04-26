export const detailPanelOriginStorageKey = "project-tracker.detail-panel-origin";

export function buildDetailPanelOrigin(basePath: string, queryString: string) {
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function getDetailPanelCloseMode(
  recordedOrigin: string | null,
  expectedOrigin: string
): "back" | "replace" {
  return recordedOrigin === expectedOrigin ? "back" : "replace";
}
