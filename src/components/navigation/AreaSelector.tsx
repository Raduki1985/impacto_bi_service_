import { Building2, ChevronDown, Settings } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { biAreas, getActiveNavigationContext } from '../../config/biAreas'
import { useAuth } from '../../contexts/useAuth'
import { cn } from '../../lib/utils'

export function AreaSelector() {
  const { hasPermission } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const availableAreas = biAreas.filter(
    (area) => area.requiredPermission === null || hasPermission(area.requiredPermission),
  )

  const activeContext = getActiveNavigationContext(location.pathname)

  function goToArea(overviewPath: string) {
    navigate(overviewPath)
    setOpen(false)
  }

  if (activeContext?.id === 'admin') {
    return (
      <div className="flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-[#e4e7ee]">
        <Settings size={15} aria-hidden="true" />
        <span className="font-semibold text-white">Administração do Portal</span>
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-[10px] border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-[#e4e7ee] transition hover:bg-white/10"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <Building2 size={15} aria-hidden="true" />
        <span className="text-[#98a2b3]">Área:</span>
        <span className="font-semibold text-white">{activeContext?.label ?? 'Selecionar área'}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {open ? (
        <>
          <button
            aria-label="Fechar seletor de área"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[220px] rounded-xl border border-[#e4e7ee] bg-white p-1.5 shadow-[0_14px_34px_rgba(16,24,40,.16)]"
            role="menu"
          >
            {availableAreas.map((area) => {
              const isActive = area.id === activeContext?.id

              return (
                <button
                  key={area.id}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#344054] hover:bg-[#f3f5f9]',
                    isActive && 'bg-[var(--accent-weak)] font-semibold text-[var(--accent)]',
                  )}
                  onClick={() => goToArea(area.overviewPath)}
                  role="menuitem"
                  type="button"
                >
                  {area.label}
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}
