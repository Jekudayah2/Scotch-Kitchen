/**
 * Motion tokens shared by every Framer Motion ("motion") use in the app.
 * Motion only animates transform and opacity. <MotionConfig reducedMotion="user">
 * at the app root removes transforms for people who prefer reduced motion.
 */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  standard: [0.2, 0, 0, 1] as const,
  in: [0.55, 0, 1, 0.45] as const,
}

export const duration = {
  fast: 0.18,
  base: 0.32,
  slow: 0.6,
  cinematic: 0.9,
}

/** Section reveal: short travel, plays once, never blocks interaction. */
export const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '0px 0px -12% 0px' },
  transition: { duration: duration.slow, ease: ease.out },
} as const

export const staggerChildren = (stagger = 0.08, delay = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren: stagger, delayChildren: delay } },
})

export const riseChild = {
  hidden: { opacity: 0, y: 22 },
  visible: { opacity: 1, y: 0, transition: { duration: duration.slow, ease: ease.out } },
}

/** Masked line reveal for large typography (text slides up inside an overflow-hidden line). */
export const lineReveal = {
  hidden: { y: '105%' },
  visible: { y: '0%', transition: { duration: duration.cinematic, ease: ease.out } },
}
