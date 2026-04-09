export function generateToken(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function idPrefix(prefix: string): string {
  return `${prefix}_${generateToken().slice(0, 16)}`
}
