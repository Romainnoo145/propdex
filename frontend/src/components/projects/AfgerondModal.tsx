import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useUpdatePipelineStage } from '@/hooks/useFavorites'

interface AfgerondModalProps {
  parcelId: string
  isOpen: boolean
  onClose: () => void
}

type AfgerondReden = 'Gekocht' | 'Afgewezen'

export function AfgerondModal({ parcelId, isOpen, onClose }: AfgerondModalProps) {
  const [selectedReden, setSelectedReden] = useState<AfgerondReden | null>(null)
  const [notitie, setNotitie] = useState('')
  const { mutate } = useUpdatePipelineStage()

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!selectedReden) return
    mutate({ parcelId, stage: 'Afgerond', afgerondReden: selectedReden, notitie: notitie || null })
    setSelectedReden(null)
    setNotitie('')
    onClose()
  }

  const handleClose = () => {
    setSelectedReden(null)
    setNotitie('')
    onClose()
  }

  const content = (
    <div className="fixed inset-0 bg-black/40 z-[100] flex items-start justify-center">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 mt-[20vh] space-y-4">
        <h2 className="text-lg font-bold text-aura-ink">Perceel afronden</h2>

        {/* Reden selector */}
        <div className="flex gap-3">
          {(['Gekocht', 'Afgewezen'] as AfgerondReden[]).map((reden) => (
            <button
              key={reden}
              onClick={() => setSelectedReden(reden)}
              className={`flex-1 border-2 rounded-xl p-3 text-sm font-semibold transition-colors ${
                selectedReden === reden
                  ? 'border-aura-amber bg-aura-amber/10 text-aura-ink'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
              }`}
            >
              {reden}
            </button>
          ))}
        </div>

        {/* Optional notitie */}
        <textarea
          value={notitie}
          onChange={(e) => setNotitie(e.target.value)}
          placeholder="Optionele notitie..."
          maxLength={500}
          rows={3}
          className="rounded-xl border border-neutral-200 p-3 w-full resize-none text-sm text-aura-ink placeholder:text-neutral-400 focus:outline-none focus:border-aura-amber/50"
        />

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-neutral-700 text-sm transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedReden}
            className="bg-aura-obsidian text-white rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:scale-[0.98]"
          >
            Afronden
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
