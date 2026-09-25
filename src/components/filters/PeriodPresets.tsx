import { todayISO } from '../../data/defaultPeriod'
import {
  PERIOD_PRESETS,
  periodPresetRange,
  periodRangeText,
  periodWithinCoverage,
  type DateCoverage,
  type PeriodPresetKey,
} from '../../data/periodPresets'
import { ChoiceChip } from '../ui/ChoiceChip'

/**
 * Atalhos de período na faixa sempre visível (aprovados pelo Mário em
 * 22/09/2026 para a apresentação à diretoria: diretor clica em "Mês passado",
 * não digita data).
 *
 * Cada atalho é um botão de pressionar: marcado quando as datas são as dele,
 * desabilitado com o motivo quando a janela cai fora da cobertura da fonte.
 * Período fora dos cinco não acende nenhum: as datas ao lado já dizem que o
 * recorte é do gestor, e um rótulo "Personalizado" só repetiria isso.
 *
 * Quem decide qual está aceso é a página (`activePeriodPreset` em
 * `data/periodPresets`), porque só ela sabe qual foi o último clicado.
 */
export function PeriodPresets({
  active,
  coverage,
  onSelect,
  today = todayISO(),
}: {
  active: PeriodPresetKey | null
  coverage: DateCoverage
  onSelect: (key: PeriodPresetKey) => void
  /** Data de hoje. No portal vale o relógio; os testes a fixam. */
  today?: string
}) {
  return (
    <div
      aria-label="Atalhos de período"
      className="flex flex-wrap items-center gap-1.5"
      role="group"
    >
      {PERIOD_PRESETS.map((preset) => {
        const range = periodPresetRange(preset.key, today)
        const available = periodWithinCoverage(range, coverage)

        return (
          <ChoiceChip
            disabled={!available}
            key={preset.key}
            onClick={() => onSelect(preset.key)}
            pressed={active === preset.key}
            title={available ? periodRangeText(range) : 'Sem dados nesse período'}
          >
            {preset.label}
          </ChoiceChip>
        )
      })}
    </div>
  )
}
