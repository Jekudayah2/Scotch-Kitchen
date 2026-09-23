/**
 * DEV-ONLY stand-in for Paystack's hosted checkout page. Records the chosen
 * outcome, then returns to the app's real callback route, which calls the
 * (emulated) paystack-verify function exactly as production does.
 */
import { CheckCircle2, CircleSlash, XCircle } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatCedis } from '@/utils/money'
import { QA_PAYSTACK_LEDGER_KEY, type SimulatedOutcome } from './functions'

export default function PaystackSimulatorPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const reference = params.get('reference') ?? ''
  const amount = Number(params.get('amount') ?? 0)

  const finish = (outcome: SimulatedOutcome) => {
    const ledger = JSON.parse(localStorage.getItem(QA_PAYSTACK_LEDGER_KEY) ?? '{}') as Record<string, SimulatedOutcome>
    ledger[reference] = outcome
    localStorage.setItem(QA_PAYSTACK_LEDGER_KEY, JSON.stringify(ledger))
    navigate(`/checkout/callback?trxref=${encodeURIComponent(reference)}&reference=${encodeURIComponent(reference)}`, { replace: true })
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-[#0b3b5b] px-4 py-10">
      <Card className="w-full max-w-md space-y-6 p-7">
        <div className="space-y-1">
          <p className="eyebrow text-info-text">QA simulator · not Paystack</p>
          <h1 className="font-display text-2xl font-bold text-ink">Pay {formatCedis(amount)}</h1>
          <p className="text-sm text-ink-3">
            Order {params.get('order')} · {params.get('email')}
          </p>
          <p className="font-mono text-xs break-all text-ink-3">{reference}</p>
        </div>
        <div className="grid gap-2">
          <Button size="lg" leadingIcon={<CheckCircle2 aria-hidden="true" />} onClick={() => finish('success')}>
            Simulate successful payment
          </Button>
          <Button size="lg" variant="secondary" leadingIcon={<XCircle aria-hidden="true" />} onClick={() => finish('failed')}>
            Simulate declined payment
          </Button>
          <Button size="lg" variant="ghost" leadingIcon={<CircleSlash aria-hidden="true" />} onClick={() => finish('abandoned')}>
            Cancel payment
          </Button>
        </div>
      </Card>
    </div>
  )
}
