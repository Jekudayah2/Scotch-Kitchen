import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { safeNextPath, signInWithPassword } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-provider'
import { GoogleButton, OrDivider, PasswordInput } from '@/features/auth/components'
import { signInSchema, type SignInValues } from '@/features/auth/schemas'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { friendlyError } from '@/utils/errors'

export default function SignInPage() {
  useDocumentTitle('Sign in')
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const { status } = useAuth()
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } })

  if (status === 'signed_in') return <Navigate to={next} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await signInWithPassword(values.email, values.password)
      toast.success('Welcome back.')
      navigate(next, { replace: true })
    } catch (error) {
      form.setError('root', { message: friendlyError(error) })
    }
  })

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="display-md">
          Welcome back<span className="text-primary-text">.</span>
        </h1>
        <p className="text-ink-3">Sign in to order, track deliveries and manage your saved locations.</p>
      </div>

      <GoogleButton next={next} />
      <OrDivider label="or sign in with email" />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {form.formState.errors.root?.message && <Notice tone="danger">{form.formState.errors.root.message}</Notice>}
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...form.register('password')} />
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-primary-text hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-ink-3">
        New to SCOTCH’s Kitchen?{' '}
        <Link to={`/sign-up${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary-text hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
