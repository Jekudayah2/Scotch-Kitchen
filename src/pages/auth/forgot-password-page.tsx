import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Notice } from '@/components/ui/feedback'
import { Field, Input } from '@/components/ui/field'
import { requestPasswordReset } from '@/features/auth/api'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/features/auth/schemas'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { friendlyError } from '@/utils/errors'

export default function ForgotPasswordPage() {
  useDocumentTitle('Reset your password')
  const [sent, setSent] = useState(false)
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' } })

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (error) {
      form.setError('root', { message: friendlyError(error) })
    }
  })

  if (sent) {
    return (
      <div className="space-y-6 text-center">
        <span className="mx-auto grid size-16 place-items-center rounded-3xl bg-success-soft text-success-text">
          <MailCheck className="size-8" aria-hidden="true" />
        </span>
        <div className="space-y-2">
          <h1 className="display-md">Check your email.</h1>
          {/* Same message whether or not the account exists, so emails can't be probed. */}
          <p className="text-ink-3">If an account uses that email, a link to choose a new password is on its way. It expires after a short time.</p>
        </div>
        <Button asChild variant="secondary" className="w-full">
          <Link to="/sign-in">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="display-md">
          Forgot your password<span className="text-primary-text">?</span>
        </h1>
        <p className="text-ink-3">Enter your account email and we’ll send you a secure reset link.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {form.formState.errors.root?.message && <Notice tone="danger">{form.formState.errors.root.message}</Notice>}
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register('email')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Send reset link
        </Button>
      </form>
      <p className="text-center text-sm text-ink-3">
        Remembered it?{' '}
        <Link to="/sign-in" className="font-semibold text-primary-text hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
