import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useDocumentTitle } from '@/hooks/use-document-title'

/** Phase 1 placeholder; the full storefront homepage replaces this in Phase 2. */
export default function HomePage() {
  useDocumentTitle(null)
  return (
    <section className="container-page py-20">
      <p className="eyebrow text-primary-text">SCOTCH’s Kitchen</p>
      <h1 className="display-xl mt-4 max-w-4xl">
        Two Ghanaian favourites. <span className="font-serif font-normal italic text-primary-text">One kitchen.</span>
      </h1>
      <Button asChild size="lg" className="mt-10" trailingIcon={<ArrowRight aria-hidden="true" />}>
        <Link to="/order">Order now</Link>
      </Button>
    </section>
  )
}
