import { filterControlClass } from './filterFieldStyles'
import type { FilterSelectOption } from './filterSelectOptions'

export type { FilterSelectOption } from './filterSelectOptions'

/**
 * Seletor da faixa de filtros: rótulo em cima, lista nativa do navegador e,
 * quando há o que explicar, uma frase logo abaixo.
 *
 * A frase existe para o seletor DESABILITADO dizer por quê: um título que só
 * aparece ao passar o mouse não explicava nada a quem olha a tela. É o caso
 * do Técnico sem o catálogo do serviço e do Tipo de cliente numa fonte que
 * não separa pessoa física de jurídica.
 *
 * A lista nativa é desenhada pelo navegador; as regras de `styles.css` sob
 * `.impacto-filter-panel select` a trazem para a paleta do portal onde o
 * navegador permite (`appearance: base-select`).
 */
export function FilterSelectField({
  describedBy,
  disabled = false,
  hint,
  label,
  onChange,
  options,
  value,
}: {
  describedBy?: string
  disabled?: boolean
  /** Motivo visível logo abaixo do seletor, quando há o que explicar. */
  hint?: string
  label: string
  onChange: (value: string) => void
  options: readonly FilterSelectOption[]
  value: string
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11.5px] font-medium text-[var(--text-secondary)]">{label}</span>
      <select
        aria-describedby={describedBy}
        className={filterControlClass}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint === undefined ? null : (
        <span className="text-[10.5px] leading-tight text-[var(--text-secondary)]">{hint}</span>
      )}
    </label>
  )
}
