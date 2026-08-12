import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Lightbulb } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/utils'

export type KpiStatus = 'ok' | 'warn' | 'bad' | 'neutral'
export type KpiTrend = 'favoravel' | 'desfavoravel' | 'neutro'

/**
 * Onde a leitura gerencial é exibida.
 *
 * `overlay` é o padrão histórico e o comportamento de todos os consumidores já
 * existentes: a leitura vive dentro do próprio card e aparece no hover, no foco
 * ou no clique, cobrindo o valor.
 *
 * `external` existe para painéis com muitos KPIs lado a lado, onde a sobreposição
 * esconde o número justamente no momento em que a pessoa aponta para ele. Nesse
 * modo o card não desenha overlay nenhum: ele vira um seletor, e o texto da
 * leitura é responsabilidade de quem consome (`onSelect` + `readingPanelId`).
 */
export type KpiReadingMode = 'overlay' | 'external'

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
  /** Onde a leitura aparece. Sem valor, mantém o overlay interno de sempre. */
  readingMode?: KpiReadingMode
  /** Só no modo externo: indica que este é o card cuja leitura está no painel. */
  selected?: boolean
  /** Só no modo externo: id do painel que recebe a leitura, para `aria-controls`. */
  readingPanelId?: string
  /** Só no modo externo: ativação por clique, toque, Enter ou Espaço. */
  onSelect?: () => void
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

/**
 * Texto da leitura com os destaques já aplicados.
 *
 * Exportado porque o modo externo tira a leitura de dentro do card: quem desenha
 * o painel precisa do mesmo destaque. Duplicar a marcação faria os dois modos
 * divergirem no primeiro texto novo. Não traz estilo junto, só os elementos:
 * cada modo pinta o `<b>` com a própria paleta.
 */
export function KpiReadingText({ text }: { text: string }) {
  return <>{highlight(text)}</>
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
  readingMode = 'overlay',
  selected = false,
  readingPanelId,
  onSelect,
}: KpiStoryCardProps) {
  const external = readingMode === 'external'
  const [open, setOpen] = useState(false)
  const cardRef = useRef<HTMLElement>(null)
  const deltaClass = deltaToneClass[tendencia]

  // Um clique/toque fora deste card fecha a leitura fixada. Como cada card
  // aberto registra seu próprio listener, um único clique em espaço vazio
  // desmarca todas as leituras ativas de uma vez.
  //
  // No modo externo não existe leitura para fechar: o painel compartilhado é
  // permanente e sempre mostra algum indicador, então nenhum listener é criado.
  useEffect(() => {
    if (external || !open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [external, open])

  const activate = () => {
    if (external) {
      onSelect?.()
      return
    }
    setOpen((value) => !value)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate()
    }
  }

  return (
    <article
      ref={cardRef}
      id={id}
      className={cn(
        'kpi-story',
        statusClass[status],
        external ? 'kpi-story--external' : null,
        external ? selected && 'is-selected' : open && 'is-open',
      )}
      role="button"
      tabIndex={0}
      aria-expanded={external ? undefined : open}
      aria-pressed={external ? selected : undefined}
      aria-controls={external ? readingPanelId : undefined}
      aria-label={
        external
          ? `${nome}: ${valor}. Ative para mostrar a leitura gerencial deste indicador no painel de leitura gerencial.`
          : `${nome}: ${valor}. Ative para ver a leitura gerencial.`
      }
      onClick={activate}
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

      {external ? null : (
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
      )}
    </article>
  )
}
