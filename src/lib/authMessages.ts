/** Kode dari backend /auth/me (authError) atau store login. */
export function authIssueMessage(code: string): string {
  switch (code) {
    case 'server_misconfigured':
      return 'Server belum siap untuk masuk. Pastikan API berjalan dan variabel SUPABASE_URL serta SUPABASE_SERVICE_ROLE_KEY sudah diisi di file lingkungan backend (.env).'
    case 'invalid_token':
    case 'session_invalid':
      return 'Sesi tidak valid atau sudah berakhir. Silakan coba masuk lagi.'
    case 'profile_missing':
      return 'Akun Anda belum diaktifkan di aplikasi. Hubungi administrator untuk mendapatkan akses.'
    case 'api_unreachable':
      return 'Tidak dapat menghubungi server aplikasi. Pastikan API berjalan (contoh: npm run dev:server) dan alamat API benar.'
    case 'bad_response':
      return 'Terjadi masalah komunikasi dengan server. Coba lagi atau perbarui aplikasi.'
    case 'no_profile':
      // kode lama; tetap ditangani agar cache tidak membingungkan
      return 'Akun Anda belum diaktifkan di aplikasi. Hubungi administrator untuk mendapatkan akses.'
    case 'login_failed':
      return 'Email atau kata sandi salah, atau layanan masuk sedang bermasalah.'
    default:
      if (code.startsWith('http_')) {
        return 'Server mengembalikan kesalahan. Coba lagi nanti.'
      }
      return 'Masuk belum berhasil. Periksa email, kata sandi, dan koneksi internet Anda.'
  }
}
