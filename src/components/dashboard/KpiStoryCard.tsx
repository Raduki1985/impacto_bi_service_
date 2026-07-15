import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export type KpiStatus = 'ok' | 'warn' | 'bad' | 'neutral'
export type KpiTrend = 'favoravel' | 'desfavoravel' | 'neutro'

export type KpiStoryCardProps = {
  id?: string
  /** Etiqueta curta do setor/contexto exibida no canto superior direito. */
  setor: string
  /** Nome do indicador. */
  nome: string
  /** Valor principal já formatado. */
  valor: string | number
  /** Linha de comparação com o período anterior (ou contexto curto). */
  delta?: string
  /** Status do indicador: dirige borda e caixa do ícone. */
  status?: KpiStatus
  /** Tendência: dirige a cor do delta e da linha de tendência. */
  tendencia?: KpiTrend
  /** Ícone semântico da Lucide (o assunto do KPI, nunca o status). */
  icon: LucideIcon
  /** Frase principal da leitura gerencial. */
  leituraTitulo: string
  /** Explicação curta; trechos entre chaves `{...}` são destacados. */
  leituraTexto: string
  /** Bloco "O QUE OBSERVAR". */
  observar: string
}

const statusClass: Record<KpiStatus, string> = {
  ok: 'is-ok',
  warn: 'is-warn',
  bad: 'is-bad',
  neutral: 'is-neutral',
}

const deltaToneClass: Record<KpiTrend, string> = {
  favoravel: 'is-fav',
  desfavoravel: 'is-unfav',
  neutro: 'is-neutral',
}

/** Converte marcações `{trecho}` em <b> destacado, sem usar innerHTML. */
function highlight(text: string): ReactNode[] {
  return text.split(/(\{[^}]+\})/g).map((part, index) => {
    if (part.startsWith('{') && part.endsWith('}')) {
      return <b key={index}>{part.slice(1, -1)}</b>
    }
    return <span key={index}>{part}</span>
  })
}

export function KpiStoryCard({
  id,
  setor,
  nome,
  valor,
  delta,
  status = 'neutral',
  tendencia = 'neutro',
  icon: Icon,
  leituraTitulo,
  leituraTexto,
  observar,
}: KpiStoryCardProps) {
  const [open, setOpen] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const deltaClass = deltaToneClass[tendencia]

  // Um clique/toque fora deste card fecha a leitura fixada. Como cada card
  // aberto registra seu próprio listener, um único clique em espaço vazio
  // desmarca todas as leituras ativas de uma vez.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const toggle = () => setOpen((value) => !value)
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return (
    <article
      ref={cardRef}
      id={id}
      className={cn('kpi-story', statusClass[status], open && 'is-open')}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-label={`${nome}: ${valor}. Ative para ver a leitura gerencial.`}
      onClick={toggle}
      onKeyDown={onKeyDown}
    >
      <div className="kpi-story__top">
        <span className="kpi-story__icon">
          <Icon size={17} aria-hidden="true" />
        </span>
        <span className="kpi-story__tag">{setor}</span>
      </div>

      <div className="kpi-story__name">{nome}</div>
      <div className="kpi-story__value">{valor}</div>
      {delta ? <div className={cn('kpi-story__delta', deltaClass)}>{delta}</div> : null}

      <div className="kpi-story__reading">
        <div className="kpi-story__eyebrow">
          <Lightbulb size={11} aria-hidden="true" /> LEITURA GERENCIAL
        </div>
        <div className="kpi-story__r-title">{leituraTitulo}</div>
        <div className="kpi-story__r-text">{highlight(leituraTexto)}</div>
        <div className="kpi-story__r-watch">
          <span className="kpi-story__r-watch-lbl">O QUE OBSERVAR </span>
          <span className="kpi-story__r-watch-txt">{observar}</span>
        </div>
      </div>
    </article>
  )
}
