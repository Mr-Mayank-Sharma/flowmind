let counter = 0

export function createId(prefix: string = "per"): string {
  return `${prefix}_${Date.now()}_${++counter}`
}
