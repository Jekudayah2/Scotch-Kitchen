import { zodResolver } from '@hookform/resolvers/zod'
import { KeyRound } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { EmptyState, Notice, PageLoader } from '@/components/ui/feedback'
import { Field } from '@/components/ui/field'
import { updatePassword } from '@/features/auth/api'
import { useAuth } from '@/features/auth/auth-provider'
import { PasswordInput } from '@/features/auth/components'
import { resetPasswordSchema, type ResetPasswordValues } from '@/features/auth/schemas'
import { useDocumentTitle } from '@/hooks/use-document-title'
import { friendlyError } from '@/utils/errors'

/**
 * Reached from the password-reset email. Supabase exchanges the link's code for a
 * short-lived recovery session (detectSessionInUrl), which authorises updateUser().
 */
export default function ResetPasswordPage() {
  useDocumentTitle('Choose a new password')
  const { status } = useAuth()
  const navigate = useNavigate()
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  if (status === 'loading') return <PageLoader label="Checking your reset link" />
  if (status === 'signed_out') {
    return (
      <EmptyState
        icon={KeyRound}
        title="This reset link has expired"
        description="Reset links work once and only for a short time. Request a new one and use it straight away."
        action={
          <Button asChild>
            <Link to="/forgot-password">Send a new link</Link>
          </Button>
        }
      />
    )
  }

  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      await updatePassword(password)
      toast.success('Your password has been updated.')
      navigate('/account', { replace: true })
    } catch (error) {
      form.setError('root', { message: friendlyError(error) })
    }
  })

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="display-md">
          Choose a new password<span className="text-primary-text">.</span>
        </h1>
        <p className="text-ink-3">You’ll use it the next time you sign in with your email.</p>
      </div>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        {form.formState.errors.root?.message && <Notice tone="danger">{form.formState.errors.root.message}</Notice>}
        <Field label="New password" hint="At least 8 characters, with a letter and a number." error={form.formState.errors.password?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('password')} />
        </Field>
        <Field label="Confirm new password" error={form.formState.errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...form.register('confirmPassword')} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>
          Update password
        </Button>
      </form>
    </div>
  )
}
