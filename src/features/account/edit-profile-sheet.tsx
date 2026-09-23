import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Sheet } from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-provider'
import { nameSchema, phoneSchema } from '@/features/auth/schemas'
import { friendlyError } from '@/utils/errors'
import { updateMyProfile } from './profile-api'

const schema = z.object({ name: nameSchema, phone: phoneSchema })
type Values = z.infer<typeof schema>

/** Name and phone only: the columns a customer may change (enforced by the database too). */
export function EditProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: { name: auth.profile?.full_name ?? auth.displayName ?? '', phone: auth.profile?.phone ?? '' },
  })

  const submit = form.handleSubmit(async (values) => {
    if (!auth.user) return
    try {
      await updateMyProfile(auth.user.id, { full_name: values.name.trim(), phone: values.phone.trim() })
      await auth.refetchProfile()
      void queryClient.invalidateQueries({ queryKey: ['account'] })
      toast.success('Your details are saved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(friendlyError(error, 'We couldn’t save your details. Please try again.'))
    }
  })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit your details"
      description="Riders use these to reach you on delivery."
      width="sm"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-profile" className="flex-1" loading={form.formState.isSubmitting}>
            Save
          </Button>
        </div>
      }
    >
      <form id="edit-profile" noValidate onSubmit={(e) => void submit(e)} className="space-y-5 p-5 sm:p-6">
        <Field label="Full name" error={form.formState.errors.name?.message} required>
          <Input autoComplete="name" {...form.register('name')} />
        </Field>
        <Field label="Phone" error={form.formState.errors.phone?.message} required>
          <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="024 123 4567" {...form.register('phone')} />
        </Field>
        <Field label="Email" hint="Your sign-in email can’t be changed here.">
          <Input value={auth.user?.email ?? ''} readOnly className="bg-surface-2" />
        </Field>
        <p className="text-sm text-ink-3">
          Want a new password?{' '}
          <Link to="/forgot-password" className="font-semibold text-primary-text underline-offset-4 hover:underline">
            Send a reset link
          </Link>
          .
        </p>
      </form>
    </Sheet>
  )
}
