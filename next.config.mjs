const authEndpoint = process.env.SUPABASE_AUTH_URL || 'http://127.0.0.1:35432'
const config = {
  async rewrites() {
    return [{ source: '/rest/v1/:path*', destination: (process.env.SUPABASE_REST_URL || 'http://127.0.0.1:35433') + '/:path*' }, { source: '/auth/v1/:path*', destination: authEndpoint + '/:path*' }]
  }
}
export default config
