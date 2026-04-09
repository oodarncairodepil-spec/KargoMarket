import crypto from 'node:crypto'

export function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`
}

export function normalizeArea(s) {
  return s.trim().toLowerCase()
}

export function json(value) {
  return JSON.stringify(value ?? null)
}
