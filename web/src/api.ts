export const API_BASE = "/astrophage-api"

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
