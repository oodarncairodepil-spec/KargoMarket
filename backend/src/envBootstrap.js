/**
 * Harus diimpor sebelum membaca process.env di config (mis. dari `import './envBootstrap.js'` di config.js).
 * override: true agar nilai di file .env mengalahkan variabel kosong dari lingkungan shell/CI.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '../..')

for (const envPath of [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
  path.join(repoRoot, 'backend', '.env'),
]) {
  dotenv.config({ path: envPath, override: true })
}

// Jika `node` dijalankan dari cwd lain, tetap coba .env di working directory.
dotenv.config({ override: true })
