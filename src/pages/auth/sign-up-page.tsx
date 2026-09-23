import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { safeNextPath, signUpWithPassword } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-provider'
import { GoogleButton, OrDivider, PasswordInput } from '@/features/auth/components'
import { signUpSchema, type SignUpValues } from '@/features/auth/schemas'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { friendlyError } from '@/utils/errors'

export default function SignUpPage() {
  useDocumentTitle('Create your account')
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const { status } = useAuth()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', phone: '', password: '', confirmPassword: '' },
  })

  if (status === 'signed_in' && !sentTo) return <Navigate to={next} replace />

  if (sentTo) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-success-soft text-success-text">
          <MailCheck className="size-8" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h1 className="display-md">Check your inbox.</h1>
          <p className="text-ink-3">
            We’ve sent a confirmation link to <strong className="text-ink">{sentTo}</strong>. Open it to activate your account, then come back to
            order.
          </p>
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link to="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await signUpWithPassword({
        fullName: values.fullName,
        email: values.email,
        phone: values.phone || undefined,
        password: values.password,
        next,
      })
      if (result.needsEmailConfirmation) {
        setSentTo(values.email)
      } else {
        toast.success('Your account is ready.')
        navigate(next, { replace: true })
      }
    } catch (error) {
      form.setError('root', { message: friendlyError(error) })
    }
  })

  const { errors } = form.formState
  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="display-md">
          Join the kitchen<span className="text-primary-text">.</span>
        </h1>
        <p className="text-ink-3">One account for ordering, tracking and saved delivery pins.</p>
      </div>

      <GoogleButton next={next} label="Sign up with Google" />
      <OrDivider label="or use your email" />

      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {errors.root?.message && <Notice tone="danger">{errors.root.message}</Notice>}
        <Field label="Full name" error={errors.fullName?.message} required>
          <Input autoComplete="name" {...form.register('fullName')} />
        </Field>
        <Field label="Email" error={errors.email?.message} required>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </Field>
        <Field label="Phone" hint="Riders call this number when they arrive." error={errors.phone?.message} optional>
          <Input type="tel" autoComplete="tel" inputMode="tel" placeholder="024 123 4567" {...form.register('phone')} />
        </Field>
        <Field label="Password" hint="At least 8 characters, with a letter and a number." error={errors.password?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Confirm password" error={errors.confirmPassword?.message} required>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-ink-3">
        Already have an account?{' '}
        <Link to={`/sign-in${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
