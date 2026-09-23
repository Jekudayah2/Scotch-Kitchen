import { m, useScroll, useTransform, type MotionValue } from 'motion/react'
import type { ReactNode, RefObject } from 'react'
import { useMediaQuery, useRichMotion } from '@/hooks/use-media'
import { duration, ease } from '@/lib/motion'
import { cn } from '@/utils/cn'

/**
 * Fades content up once as it enters the viewport. Travel is shorter and
 * quicker on phones; people who prefer reduced motion get the fade only
 * (MotionConfig at the app root drops the transform).
 */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: desktop ? 28 : 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -8% 0px' }}
      transition={{ duration: desktop ? duration.slow : 0.42, ease: ease.out, delay }}
    >
      {children}
    </m.div>
  )
}

/** One line of a large headline that slides up from behind a mask on first paint. */
export function HeadlineLine({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <m.span
        className={cn('block', className)}
        initial={{ y: '105%' }}
        animate={{ y: '0%' }}
        transition={{ duration: duration.cinematic, ease: ease.out, delay }}
      >
        {children}
      </m.span>
    </span>
  )
}

/**
 * Scroll-linked drift for brand imagery. Desktop only and never for
 * reduced-motion users; everywhere else it is a static 0.
 */
export function useParallax(target: RefObject<HTMLElement | null>, distance = 48): MotionValue<number> | number {
  const rich = useRichMotion()
  const { scrollYProgress } = useScroll({ target, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance])
  return rich ? y : 0
}
