import { useQueryClient } from '@tanstack/react-query'
import { MapPin, MapPinPlus, PencilLine, Star, Trash2 } from 'lucide-react'
import { useReducer, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ConfirmDialog, Sheet } from '@/components/ui/dialog'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback'
import { Field, Input, Textarea } from '@/components/ui/field'
import { accountKeys } from '@/features/account/api'
import { useAuth } from '@/features/auth/auth-provider'
import { LocationPicker } from '@/features/delivery/location-picker'
import { initialPickerState, locationReducer } from '@/features/delivery/location-state'
import {
  createSavedLocation,
  deleteSavedLocation,
  pointToSavedInput,
  savedLocationsKey,
  savedToPoint,
  updateSavedLocation,
  useSavedLocations,
} from '@/features/delivery/saved-locations'
import { useStoreSettings } from '@/features/products/queries'
import { useDocumentTitle } from '@/hooks/use-document-title'
import type { SavedLocation } from '@/types/domain'
import { friendlyError } from '@/utils/errors'
import { formatAccuracy, formatCoordinates } from '@/utils/geo'

const MAX_SAVED = 10

/** Add or edit a saved place: pin on the map, then a label and optional notes. */
function PlaceSheet({ open, onOpenChange, editing, isFirst }: { open: boolean; onOpenChange: (open: boolean) => void; editing: SavedLocation | null; isFirst: boolean }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const settings = useStoreSettings()
  const [state, dispatch] = useReducer(locationReducer, editing ? { temporary: null, confirmed: savedToPoint(editing) } : initialPickerState)
  const [label, setLabel] = useState(editing?.label ?? 'Home')
  const [instructions, setInstructions] = useState(editing?.delivery_instructions ?? '')
  const [saving, setSaving] = useState(false)
  const bounds =
    settings.data && settings.data.service_min_latitude !== null
      ? {
          minLatitude: settings.data.service_min_latitude,
          maxLatitude: settings.data.service_max_latitude as number,
          minLongitude: settings.data.service_min_longitude as number,
          maxLongitude: settings.data.service_max_longitude as number,
        }
      : null
  const confirmed = state.confirmed
  const canSave = Boolean(confirmed) && !state.temporary && label.trim().length > 0

  const save = async () => {
    if (!user || !confirmed) return
    setSaving(true)
    try {
      const input = pointToSavedInput({ ...confirmed, instructions }, label, editing ? editing.is_default : isFirst)
      if (editing) await updateSavedLocation(editing.id, input)
      else await createSavedLocation(user.id, input)
      await queryClient.invalidateQueries({ queryKey: savedLocationsKey(user.id) })
      void queryClient.invalidateQueries({ queryKey: accountKeys.summary(user.id) })
      toast.success(editing ? 'Place updated.' : 'Place saved.')
      onOpenChange(false)
    } catch (error) {
      toast.error(friendlyError(error, 'We couldn’t save this place. Please try again.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? `Edit ${editing.label}` : 'Save a place'}
      description="Pick the exact spot, then give it a name you’ll recognise at checkout."
      width="lg"
      footer={
        <div className="flex gap-3 pb-1">
          <Button variant="secondary" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={!canSave} loading={saving} onClick={() => void save()}>
            {editing ? 'Save changes' : 'Save place'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5 p-5 sm:p-6">
        <LocationPicker state={state} dispatch={dispatch} savedLocations={[]} bounds={bounds} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" hint="For example Home, Hostel or Work." required>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={40} />
          </Field>
          <Field label="Delivery instructions" optional>
            <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={500} rows={2} />
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

export default function SavedLocationsPage() {
  useDocumentTitle('Saved places')
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const saved = useSavedLocations()
  const [sheet, setSheet] = useState<{ open: boolean; editing: SavedLocation | null; key: number }>({ open: false, editing: null, key: 0 })
  const [removing, setRemoving] = useState<SavedLocation | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const list = saved.data ?? []
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: savedLocationsKey(user?.id ?? null) })
    void queryClient.invalidateQueries({ queryKey: accountKeys.summary(user?.id ?? null) })
  }

  const openSheet = (editing: SavedLocation | null) => setSheet((s) => ({ open: true, editing, key: s.key + 1 }))

  const makeDefault = async (place: SavedLocation) => {
    setBusyId(place.id)
    try {
      await updateSavedLocation(place.id, { is_default: true })
      refresh()
      toast.success(`${place.label} is now your default place.`)
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    if (!removing) return
    setBusyId(removing.id)
    try {
      await deleteSavedLocation(removing.id)
      refresh()
      toast.success(`${removing.label} removed.`)
      setRemoving(null)
    } catch (error) {
      toast.error(friendlyError(error))
    } finally {
      setBusyId(null)
    }
  }

  if (saved.isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading saved places">
        {[0, 1].map((i) => (
          <Skeleton key={i} className="h-44 rounded-card" />
        ))}
      </div>
    )
  }
  if (saved.isError) return <ErrorState title="We couldn’t load your saved places" error={saved.error} onRetry={() => void saved.refetch()} />

  const full = list.length >= MAX_SAVED
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-3">
          {list.length} of {MAX_SAVED} places saved
        </p>
        <Button onClick={() => openSheet(null)} disabled={full} leadingIcon={<MapPinPlus aria-hidden="true" />}>
          Save a place
        </Button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={MapPin}
            title="No saved places yet"
            description="Save home, your hostel or work once, then choose it in one tap at checkout."
            action={
              <Button onClick={() => openSheet(null)} leadingIcon={<MapPinPlus aria-hidden="true" />}>
                Save a place
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {list.map((place) => (
            <li key={place.id} className="flex flex-col rounded-card border border-line bg-surface p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <MapPin className="size-4.5 text-primary-text" aria-hidden="true" />
                  {place.label}
                </p>
                {place.is_default && (
                  <Badge tone="brand" size="sm">
                    <Star aria-hidden="true" />
                    Default
                  </Badge>
                )}
              </div>
              <p className="mt-2 font-semibold text-ink-2">{place.address}</p>
              {place.landmark && <p className="text-sm text-ink-3">Landmark: {place.landmark}</p>}
              {place.delivery_instructions && <p className="text-sm text-ink-3">Note: {place.delivery_instructions}</p>}
              <p className="mt-1 font-mono text-xs text-ink-3">
                {formatCoordinates(place)} · {formatAccuracy(place.accuracy_m)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="sm" onClick={() => openSheet(place)} leadingIcon={<PencilLine aria-hidden="true" />}>
                  Edit
                </Button>
                {!place.is_default && (
                  <Button variant="ghost" size="sm" loading={busyId === place.id} onClick={() => void makeDefault(place)} leadingIcon={<Star aria-hidden="true" />}>
                    Make default
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="ml-auto text-danger-text" onClick={() => setRemoving(place)} leadingIcon={<Trash2 aria-hidden="true" />}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {sheet.open && (
        <PlaceSheet
          key={sheet.key}
          open={sheet.open}
          onOpenChange={(open) => setSheet((s) => ({ ...s, open }))}
          editing={sheet.editing}
          isFirst={list.length === 0}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.label ?? 'this place'}?`}
        description="Past orders keep their delivery details. This only removes the saved place."
        confirmLabel="Remove"
        tone="danger"
        loading={busyId !== null && busyId === removing?.id}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
