import { CircleSlash, Clock } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'

import type { DepartmentCoverage, PreviewCatalogPage } from './accessProfilesPreviewModel'
import { systemManagedBadgeClass } from './accessProfilesUi'
import {
  coveragePanelColumns,
  ONE_COLUMN_WIDTH,
  TWO_COLUMN_WIDTH,
} from './coveragePanelColumns'
import { useCoverageTooltip } from './useCoverageTooltip'

/**
 * Label de cobertura de um departamento, e o detalhamento das páginas que ele
 * revela.
 *
 * Mostra o nome do departamento e a fração de páginas disponíveis que o perfil
 * libera nele, com preenchimento proporcional da esquerda para a direita dentro
 * do próprio label: `12/13` preenche cerca de 92%.
 *
 * Todos os departamentos usam a mesma identidade azul do portal. A cor não
 * distingue departamento nenhum, e é justamente por isso que ela não precisa
 * ser calculada, sorteada nem persistida: o que distingue um label do outro é o
 * nome e a fração, que estão escritos.
 *
 * O que a cor comunica é apenas a proporção, e mesmo isso não fica só nela: o
 * preenchimento é mais forte que o fundo para o olho, e a fração diz o mesmo em
 * número.
 */

/**
 * Azul institucional em quatro tons, literais como as demais cores desta área.
 *
 * O painel das Configurações é branco fixo nos dois temas, e o contraste entre
 * `FILL` e `SURFACE` é o que mantém a área preenchida visível sem transformar o
 * label em um selo azul chapado. O texto é o tom mais escuro dos quatro e
 * continua legível sobre os dois fundos.
 */
const SURFACE = '#f4f7fc'
const FILL = '#dce7ff'
const BORDER = '#c8d4ea'
const TEXT = '#274a8a'

/** Vermelho suave da página não liberada, e cinza da que ainda não abre. */
const DENIED_TEXT = '#b42318'
const PENDING_TEXT = '#667085'

/**
 * Densidade do label.
 *
 * Compacto de propósito: um perfil chega a mostrar onze departamentos lado a
 * lado dentro de um card, e cada pixel de padding aqui vira uma linha a mais
 * lá. 11px de texto com 8px de respiro horizontal mantém a fração legível sem
 * transformar o card em uma parede de pílulas.
 */
const labelShellClass =
  'relative inline-flex max-w-full items-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-[1.45]'

/* -------------------------------------------------------------------------- */
/* Label                                                                      */
/* -------------------------------------------------------------------------- */

/** Miolo visual do label, compartilhado pelas versões estática e interativa. */
function CoverageContent({
  fraction,
  label,
  percent,
}: {
  fraction: string
  label?: string
  percent: number
}) {
  return (
    <>
      {/* Preenchimento atrás do texto, preso à borda esquerda e recortado pelo
          arredondamento do label. Sem largura quando a cobertura é zero. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0"
        style={{ backgroundColor: FILL, width: `${percent}%` }}
      />
      {label === undefined ? null : (
        <span aria-hidden="true" className="relative min-w-0 break-words">
          {label}
        </span>
      )}
      <span aria-hidden="true" className="relative flex-none tabular-nums">
        {fraction}
      </span>
    </>
  )
}

/**
 * Label de cobertura sem interação, para onde o detalhamento já está na tela.
 *
 * É o caso do acordeão do formulário: as páginas do departamento estão logo
 * abaixo, com as caixas de seleção, e abrir um segundo painel por cima delas
 * repetiria o que já está aberto. O `summary` do acordeão também já é um
 * elemento acionável, e um botão dentro dele seria marcação inválida.
 */
export function DepartmentCoverageBadge({
  accessibleLabel,
  fraction,
  label,
  percent,
}: {
  /** Nome acessível completo, no lugar do texto abreviado que aparece na tela. */
  accessibleLabel: string
  fraction: string
  /** Sem rótulo, o label mostra só a fração. */
  label?: string
  percent: number
}) {
  return (
    <span
      className={labelShellClass}
      style={{ backgroundColor: SURFACE, borderColor: BORDER, color: TEXT }}
    >
      <CoverageContent fraction={fraction} label={label} percent={percent} />
      <span className="sr-only">{accessibleLabel}</span>
    </span>
  )
}

/**
 * Label de um acesso que não é departamental, como a Visão Geral Executiva.
 *
 * Sem fração e sem preenchimento: não existe "parte" de um acesso corporativo,
 * ele é concedido inteiro. O contorno tracejado saiu e a cor virou a mesma do
 * selo `Sistema`, por `systemManagedBadgeClass`: os dois são concedidos pelo
 * portal e não se editam, e o cinza escuro os separa dos departamentos, que são
 * claros, azuis e editáveis. Sem cadeado, porque o cadeado identifica o perfil
 * protegido, e não o acesso.
 *
 * As medidas continuam as do label de cobertura, e não as do selo: ele aparece
 * na mesma linha dos departamentos e precisa ter a altura deles.
 */
export function CorporateAccessBadge({ label }: { label: string }) {
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[1.45] ${systemManagedBadgeClass}`}
    >
      <span className="min-w-0 break-words">{label}</span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Detalhamento                                                               */
/* -------------------------------------------------------------------------- */

type Anchor = {
  top: number
  bottom: number
  left: number
  viewportWidth: number
  viewportHeight: number
}

const VIEWPORT_MARGIN = 8
const GAP = 6

/**
 * Label de cobertura que revela a relação completa de páginas do departamento.
 *
 * Aberto por mouse, por foco de teclado e por toque, e não só por hover: um
 * detalhamento que depende de passar o cursor não existe para quem navega pelo
 * teclado nem para quem usa o celular. O toque e o clique fixam o painel, para
 * ele não fechar enquanto a pessoa lê; sair com o cursor só fecha o que foi
 * aberto por hover.
 *
 * O conteúdo é a descrição acessível do label, por `aria-describedby`, e o
 * painel tem `role="tooltip"`: o portal tira o painel do lugar dele na árvore, e
 * é a descrição que devolve a ligação para quem usa leitor de tela.
 *
 * Um por vez na tela inteira. A vez pertence a quem `CoverageTooltipProvider`
 * apontar como ativo, e abrir aqui é ANTES DE MAIS NADA tomar essa vez: o label
 * que a perdeu para de renderizar o painel no mesmo render, sem depender de
 * nenhum aviso entre irmãos.
 */
export function DepartmentCoverageChip({
  coverage,
  label,
  pages,
}: {
  coverage: DepartmentCoverage
  label: string
  /** Todas as páginas do departamento, na ordem oficial do catálogo. */
  pages: readonly PreviewCatalogPage[]
}) {
  const panelId = useId()
  const { claim, isActive, release } = useCoverageTooltip(panelId)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [anchor, setAnchor] = useState<Anchor | null>(null)
  // Fixado por clique ou toque: nesse estado, tirar o cursor não fecha.
  const [pinned, setPinned] = useState(false)

  /**
   * Aberto exige as duas coisas: âncora medida E a vez.
   *
   * Derivado no render, e não apagado por efeito: quando outro label assume, este
   * fecha no mesmo render, sem um quadro em que os dois painéis coexistem. A
   * âncora antiga que sobra é inofensiva, porque toda reabertura mede de novo.
   */
  const open = isActive && anchor !== null

  /**
   * Fixação efetiva: só vale enquanto este label tem a vez.
   *
   * Ter perdido a vez sem ter passado pelo próprio fechamento deixa `pinned`
   * verdadeiro aqui dentro. Ler o valor cru faria o toque seguinte neste label
   * ser interpretado como "clicou no fixado, então feche", e ele não abriria.
   */
  const heldPinned = isActive && pinned

  const granted = pages.filter((page) => page.granted)
  const pending = pages.filter((page) => !page.granted && page.inDevelopment)
  const denied = pages.filter((page) => !page.granted && !page.inDevelopment)

  const columns = coveragePanelColumns({
    granted: granted.length,
    pending: pending.length,
    denied: denied.length,
  })

  function show(pin: boolean) {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()

    claim(panelId)
    setAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
    // A fixação só sobrevive a uma reabertura por hover ou foco se este label
    // NUNCA tiver perdido a vez. Recuperá-la depois de outro label ter assumido
    // restauraria uma leitura que já foi encerrada, e o painel voltaria fixado
    // sem ninguém ter clicado nele.
    setPinned(pin || heldPinned)
  }

  /**
   * Fecha este label e devolve a vez.
   *
   * `release` é ignorado pelo coordenador quando este label já não é o ativo: um
   * `mouseleave` atrasado, chegando depois de outro label ter assumido, não pode
   * apagar o painel que acabou de abrir.
   */
  const hide = useCallback(() => {
    setAnchor(null)
    setPinned(false)
    release(panelId)
  }, [panelId, release])

  /** Recalcula a âncora a partir da posição atual do label, sem mudar o estado fixado. */
  function reposition() {
    const trigger = triggerRef.current
    if (!trigger) return

    const rect = trigger.getBoundingClientRect()

    setAnchor({
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    })
  }

  /**
   * Posiciona o painel depois que ele existe, medindo a altura real.
   *
   * Não há estimativa nem `max-height` com rolagem: o painel é montado
   * invisível, medido e só então revelado na posição final. É isso que garante
   * que ele nunca é cortado e nunca ganha barra de rolagem própria, qualquer
   * que seja o tamanho do departamento.
   *
   * As coordenadas são escritas direto no elemento, e não guardadas em estado:
   * medir e reposicionar por estado exigiria um segundo render a cada abertura,
   * e o painel piscaria na primeira posição antes de ir para a definitiva.
   */
  const placePanel = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node
      if (!node || !anchor) return

      const height = node.offsetHeight
      const width = node.offsetWidth
      const { viewportHeight, viewportWidth } = anchor

      const left = Math.min(
        Math.max(anchor.left, VIEWPORT_MARGIN),
        Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN),
      )

      const below = anchor.bottom + GAP
      const above = anchor.top - GAP - height
      const fitsBelow = below + height <= viewportHeight - VIEWPORT_MARGIN
      const fitsAbove = above >= VIEWPORT_MARGIN

      // Sem lado que caiba (painel alto em tela baixa), gruda no topo possível:
      // é melhor sair um pouco do alinhamento com o label do que cortar a lista.
      const top = fitsBelow
        ? below
        : fitsAbove
          ? above
          : Math.max(VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN)

      node.style.left = `${left}px`
      node.style.top = `${top}px`
      node.style.visibility = 'visible'
    },
    [anchor],
  )

  /**
   * Rolagem: o painel aberto por hover ou por foco fecha; o painel FIXADO
   * acompanha o label.
   *
   * Fechar sempre parecia certo até o painel ser aberto dentro do modal: ao
   * clicar dentro do painel, o Radix devolve o foco para dentro do diálogo, e
   * essa devolução rola o container o suficiente para disparar um evento de
   * rolagem que ninguém pediu. O painel que a pessoa acabou de fixar fechava
   * sozinho no primeiro toque. Reposicionar em vez de fechar resolve os dois
   * casos: o painel fixado não some, e continua colado ao seu label enquanto o
   * conteúdo rola.
   */
  useEffect(() => {
    if (!open) return

    function onScroll() {
      if (heldPinned) reposition()
      else hide()
    }

    /**
     * Escape fecha o painel e PARA por aqui.
     *
     * O Radix Dialog escuta Escape no `document`, em fase de captura, e fecharia
     * o modal inteiro junto. Este ouvinte fica na `window`, também em captura:
     * a captura desce de `window` para `document`, então ele roda primeiro e
     * interrompe a propagação. Com o painel fechado, o Escape seguinte chega
     * normalmente ao modal e o fecha, que é o comportamento esperado.
     */
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return

      event.stopPropagation()
      hide()
    }

    function onPointerDown(event: Event) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return

      hide()
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', hide)
    document.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', hide)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
    // `heldPinned` entra nas dependências porque a rolagem age diferente
    // conforme ele: sem isso, o ouvinte ficaria enxergando o valor da montagem.
    // `hide` entra porque agora devolve a vez ao coordenador, e é memorizado
    // para os ouvintes não serem reinstalados a cada render.
  }, [heldPinned, hide, open])

  function onPointerEnter(event: ReactPointerEvent<HTMLButtonElement>) {
    // Toque e caneta disparam `pointerenter` logo antes do clique. Abrir aqui
    // faria o clique seguinte fechar de imediato, e o painel piscaria.
    if (event.pointerType !== 'mouse') return

    show(false)
  }

  function onPointerLeave(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== 'mouse' || heldPinned) return

    hide()
  }

  /**
   * Perder o foco fecha o painel aberto por teclado, mas não o painel fixado.
   *
   * Clicar dentro do painel tira o foco do gatilho, porque o painel não é
   * focável. Fechar nesse momento fecharia a leitura no instante em que a
   * pessoa toca nela. O painel fixado sai por Escape, por clique fora ou por um
   * segundo clique no próprio label.
   */
  function onBlur() {
    if (heldPinned) return

    hide()
  }

  const panelWidth = anchor
    ? Math.min(
        columns.wide ? TWO_COLUMN_WIDTH : ONE_COLUMN_WIDTH,
        anchor.viewportWidth - VIEWPORT_MARGIN * 2,
      )
    : 0

  return (
    <>
      <button
        aria-describedby={open ? panelId : undefined}
        aria-label={`${coverage.accessibleLabel}. Ver as páginas do departamento.`}
        className={`${labelShellClass} cursor-pointer transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1`}
        onBlur={onBlur}
        onClick={() => (heldPinned ? hide() : show(true))}
        onFocus={() => show(false)}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        ref={triggerRef}
        style={{ backgroundColor: SURFACE, borderColor: BORDER, color: TEXT }}
        type="button"
      >
        <CoverageContent fraction={coverage.fraction} label={label} percent={coverage.percent} />
      </button>

      {/* Renderizado por `open`, e NÃO por `anchor`: um label que perdeu a vez
          continua com a âncora medida, e ligar o painel à âncora o mantinha na
          tela depois de outro label ter assumido, com dois painéis visíveis ao
          mesmo tempo. Quem decide se este painel existe é o coordenador. */}
      {open
        ? createPortal(
            <div
              className="fixed z-[70] rounded-lg border border-[#e4e7ee] bg-white px-2.5 py-2 shadow-[0_8px_24px_rgba(16,24,40,.16)]"
              id={panelId}
              // O painel é levado para fora do modal pelo portal, então o Radix
              // o enxerga como "fora" e fecharia o modal a um toque aqui
              // dentro. O ouvinte de ponteiro dele fica no `document` em fase
              // de borbulha, e interromper aqui basta para o toque não sair da
              // leitura que a pessoa está fazendo.
              onPointerDown={(event) => event.stopPropagation()}
              ref={placePanel}
              role="tooltip"
              style={{
                left: 0,
                // Nasce invisível e fora da tela: `placePanel` mede a altura
                // real e só então o revela na posição definitiva.
                top: -9999,
                visibility: 'hidden',
                width: panelWidth,
                /**
                 * Enquanto o diálogo está aberto, o Radix coloca
                 * `pointer-events: none` no `body` e devolve `auto` apenas para
                 * a camada dele. O painel é filho do `body` pelo portal, então
                 * herdava `none`: ficava visível, mas o ponteiro atravessava
                 * como se ele não existisse. O clique caía no conteúdo do modal
                 * atrás dele, era lido como clique FORA e fechava a leitura no
                 * exato momento em que a pessoa tocava nela.
                 */
                pointerEvents: 'auto',
              }}
            >
              <p className="text-[11.5px] font-semibold leading-4 text-[#172033]">{label}</p>

              {granted.length > 0 ? (
                <ul
                  className={`mt-1.5 grid gap-x-3 gap-y-0.5 ${columns.granted ? 'grid-cols-2' : ''}`}
                >
                  {granted.map((page) => (
                    <li className="text-[11px] leading-4 text-[#475467]" key={page.pageKey}>
                      {page.label}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[11px] leading-4 text-[#667085]">
                  Nenhuma página liberada.
                </p>
              )}

              {/* Divisor discreto, e depois o que o perfil NÃO entrega. As
                  páginas em desenvolvimento vêm antes porque não são uma
                  decisão do perfil: elas ainda não abrem para ninguém. A seção
                  vermelha fica sempre por último. */}
              {pending.length > 0 || denied.length > 0 ? (
                <div className="mt-2 border-t border-[#eef0f4] pt-1.5">
                  {pending.length > 0 ? (
                    <ul
                      className={`grid gap-x-3 gap-y-0.5 ${columns.pending ? 'grid-cols-2' : ''}`}
                      style={{ color: PENDING_TEXT }}
                    >
                      {pending.map((page) => (
                        <li
                          className="flex items-start gap-1.5 text-[11px] leading-4"
                          key={page.pageKey}
                        >
                          <Clock aria-hidden="true" className="mt-0.5 flex-none" size={10} />
                          <span className="min-w-0 break-words">
                            {page.label}
                            {/* O estado escrito só para leitor de tela: na tela
                                ele é o ícone e o tom, e um sufixo por linha
                                encheria o painel de texto repetido. */}
                            <span className="sr-only"> Em desenvolvimento</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {denied.length > 0 ? (
                    <ul
                      className={`grid gap-x-3 gap-y-0.5 ${columns.denied ? 'grid-cols-2' : ''} ${
                        pending.length > 0 ? 'mt-1' : ''
                      }`}
                      style={{ color: DENIED_TEXT }}
                    >
                      {denied.map((page) => (
                        <li
                          className="flex items-start gap-1.5 text-[11px] leading-4"
                          key={page.pageKey}
                        >
                          <CircleSlash aria-hidden="true" className="mt-0.5 flex-none" size={10} />
                          <span className="min-w-0 break-words">
                            {page.label}
                            <span className="sr-only"> Não liberada</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
