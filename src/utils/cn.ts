import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge about our custom tokens so conflicting classes resolve correctly.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ['soft', 'lift', 'float'],
      radius: ['4xl', '5xl'],
    },
    classGroups: {
      'font-family': [{ font: ['sans', 'display', 'serif', 'mono'] }],
      'font-size': ['display-xl', 'display-lg', 'display-md'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
