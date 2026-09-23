import { z } from 'zod'

/** Mirrors private.is_valid_phone() in the database. */
export const PHONE_PATTERN = /^\+?[0-9][0-9 ()-]{6,19}$/

export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, '')
  return PHONE_PATTERN.test(value) && digits.length >= 7 && digits.length <= 15
}

export const emailSchema = z.string().trim().min(1, 'Enter your email address').pipe(z.email('Enter a valid email address'))

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Enter a phone number')
  .refine(isValidPhone, 'Enter a valid phone number, e.g. 024 123 4567')

export const optionalPhoneSchema = z
  .string()
  .trim()
  .refine((v) => v === '' || isValidPhone(v), 'Enter a valid phone number, e.g. 024 123 4567')

export const nameSchema = z.string().trim().min(2, 'Enter your full name').max(120, 'That name is too long')

export const passwordSchema = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use 72 characters or fewer')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Include at least one letter and one number')

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})

export const signUpSchema = z
  .object({
    fullName: nameSchema,
    email: emailSchema,
    phone: optionalPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match' })

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const resetPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords don’t match' })

export type SignInValues = z.infer<typeof signInSchema>
export type SignUpValues = z.infer<typeof signUpSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
