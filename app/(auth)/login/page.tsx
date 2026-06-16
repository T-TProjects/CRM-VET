import LoginForm from '@/components/auth/login-form'

// Render at request time so the build never depends on Supabase env vars
// being present (they're only needed at runtime).
export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return <LoginForm />
}
