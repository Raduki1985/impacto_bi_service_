import { ChevronDown, Lock } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { profileColorClass } from '../../lib/profileColors'

/**
 * Peças visuais compartilhadas pela tela Perfis de acesso.
 *
 * Existem para a página e os dois modais terem o mesmo traço sem duplicar
 * classe: abas, acordeão de departamento, avatar, selo de página e caixa de
 * seleção aparecem em mais de um lugar, e uma divergência entre eles seria
 * percebida na hora.
 *
 * As cores saem dos tokens do portal e dos tokens das Configurações
 * (`.impacto-settings`, em `styles.css`), então as peças seguem o tema claro
 * e o escuro sem regra própria. Até 13/10/2026 eram literais claras, porque o
 * painel e os modais eram brancos fixos nos dois temas.
 */

export const chipClass =
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold'
export const sectionTitleClass =
  'text-[11.5px] font-semibold uppercase tracking-wide text-[var(--settings-muted)]'
export const fieldLabelClass = 'mb-1.5 block text-[12.5px] font-semibold text-[var(--text-item)]'
export const fieldClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[13px] text-[var(--text-heading)] placeholder:text-[var(--settings-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'

/** Números alinhados apenas onde há contagem, e não no texto corrido. */
export const countClass = 'tabular-nums'

/**
 * Marca de campo obrigatório: o asterisco ao lado do rótulo.
 *
 * Mora aqui porque vale para os dois formulários das Configurações, o de
 * Usuários e o de Perfis de Acesso, e duas cópias do mesmo span divergiriam na
 * primeira alteração de cor ou de espaçamento.
 *
 * `aria-hidden` porque o asterisco é sinal visual: quem usa leitor de tela
 * recebe a obrigatoriedade pelo `aria-required` do próprio campo, e ouvir
 * "asterisco" no meio do rótulo não acrescentaria nada.
 *
 * Vermelho do portal, o mesmo das recusas. Não é um erro em vigor, mas é a cor
 * que o olho já associa a "isto exige atenção", e em cinza a marca se perderia
 * dentro do rótulo.
 */
export function RequiredMark() {
  return (
    <span aria-hidden="true" className="font-semibold text-[var(--settings-danger)]">
      *
    </span>
  )
}

/**
 * Identidade única dos labels MANTIDOS PELO PORTAL.
 *
 * Vale para dois e apenas dois: o selo `Sistema`, que marca o Acesso do Sistema,
 * e o label `Visão Geral Executiva`. Os dois dizem a mesma coisa por baixo, que
 * é "isto quem concede é o portal, e ninguém edita", e antes diziam isso de
 * formas diferentes: um era uma pílula azul clara chapada, o outro um contorno
 * tracejado. Duas aparências para uma regra só ensinavam duas regras.
 *
 * A inversão (fundo escuro, texto claro) é o que os separa de tudo o que é
 * editável na tela, e o cinza é o que a mantém fora da disputa de cor: azul na
 * página é a cor do que se concede e do que se abre, e os departamentos e o
 * `Ver detalhes` já a usam (no escuro os dois passam ao verde). Os badges Administrador, Executivo e Analista
 * continuam com as cores oficiais do Perfil do Sistema.
 *
 * Só cor e borda moram aqui. Tamanho, peso e respiro continuam de cada label,
 * porque os dois vivem em contextos de densidade diferente e precisam manter a
 * altura dos vizinhos: o selo acompanha o nome do perfil, e o label de acesso
 * acompanha os labels de cobertura.
 *
 * Contraste medido de #f2f4f7 sobre #344054: 9,5:1, acima de AAA para texto
 * pequeno. No escuro a inversão se mantém pela classe em `styles.css`: a
 * pílula fica clara sobre o painel escuro, com o texto escuro (14,5:1).
 */
export const systemManagedBadgeClass = 'impacto-system-badge border'

/* -------------------------------------------------------------------------- */
/* Abas                                                                       */
/* -------------------------------------------------------------------------- */

export type ModalTab = {
  id: string
  label: string
}

/**
 * Abas do modal, com a semântica de tablist do ARIA.
 *
 * Existem apenas na criação e na edição. A consulta é uma leitura contínua e
 * não tem abas: quem consulta quer ver o perfil inteiro de uma vez, e três
 * cliques para ler três blocos curtos era trabalho sem retorno.
 *
 * Setas, Home e End não são implementadas à mão: cada aba é um botão real na
 * ordem de tabulação, então Tab e Enter já percorrem e acionam tudo. O visual
 * segue as abas das Configurações, em versão compacta.
 *
 * `baseId` vem de fora porque o painel de conteúdo mora em outro ponto da
 * árvore e precisa apontar para a mesma aba.
 */
export function ModalTabs({
  activeTabId,
  baseId,
  onTabChange,
  tabs,
}: {
  activeTabId: string
  baseId: string
  onTabChange: (tabId: string) => void
  tabs: readonly ModalTab[]
}) {
  return (
    // Faixa tingida sob as abas: a aba ativa tem a superfície do painel e
    // emenda no painel de conteúdo, do mesmo jeito que as abas das
    // Configurações. É isso que liga a aba ao conteúdo em vez de deixar as duas
    // como blocos soltos.
    <div
      className="flex flex-none flex-wrap gap-1 border-b border-[var(--divider)] bg-[var(--settings-tint)] px-5 pb-0 pt-1.5"
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTabId

        return (
          <button
            aria-controls={`${baseId}-${tab.id}-panel`}
            aria-selected={active}
            className={
              active
                ? 'relative -mb-px cursor-pointer rounded-t-lg border border-[var(--divider)] border-b-[var(--surface)] bg-[var(--surface)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
                : 'cursor-pointer rounded-t-lg px-3.5 py-2 text-[12.5px] font-medium text-[var(--settings-muted)] transition hover:bg-[var(--hover-bg)] hover:text-[var(--text-item)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
            }
            id={`${baseId}-${tab.id}-tab`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function ModalTabPanel({
  baseId,
  children,
  tabId,
}: {
  baseId: string
  children: ReactNode
  tabId: string
}) {
  return (
    <div
      aria-labelledby={`${baseId}-${tabId}-tab`}
      id={`${baseId}-${tabId}-panel`}
      role="tabpanel"
      tabIndex={-1}
    >
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Acordeão de departamento                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Um departamento por vez, recolhido por padrão.
 *
 * `details` e `summary` nativos, e não um componente próprio: já são operáveis
 * por teclado, anunciam o estado expandido e dispensam JavaScript de foco.
 */
export function DepartmentAccordion({
  children,
  label,
  meta,
}: {
  children: ReactNode
  label: string
  /**
   * Texto curto à direita do nome, como a contagem de páginas concedidas.
   *
   * Opcional de propósito: sem nada a acrescentar, o departamento aparece só
   * com o nome, em vez de carregar um número que não muda a decisão.
   */
  meta?: ReactNode
}) {
  return (
    <details className="group rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold text-[var(--text-item)] transition hover:bg-[var(--hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)] [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="shrink-0 text-[var(--settings-faint)] transition group-open:rotate-180"
          size={14}
        />
        <span className="min-w-0 flex-1 break-words">{label}</span>
        {meta ? (
          <span className="shrink-0 text-[11.5px] font-normal text-[var(--settings-muted)]">{meta}</span>
        ) : null}
      </summary>
      <div className="border-t border-[var(--divider)] px-3 py-1.5">{children}</div>
    </details>
  )
}

/* -------------------------------------------------------------------------- */
/* Modal central                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ancoragem comum dos dois modais: centro da tela, altura limitada pela
 * viewport e rolagem apenas no conteúdo.
 *
 * Os drawers laterais saíram. O conteúdo desta área é largo (departamentos,
 * páginas, listas de usuários) e um painel colado na borda direita obrigava a
 * ler tudo em uma coluna estreita enquanto metade da tela ficava escurecida sem
 * uso. O modal central usa a largura de que a informação precisa e coloca a
 * leitura no eixo do olhar.
 *
 * `max-h` em unidade de viewport e `flex flex-col` são o que mantêm cabeçalho e
 * rodapé fixos: só a faixa do meio recebe `overflow-y-auto`. No celular o modal
 * ocupa quase a tela inteira, e `max-w` em `vw` impede rolagem horizontal em
 * qualquer largura.
 */
export const modalOverlayClass = 'fixed inset-0 z-50 bg-[#101828]/50'
export const modalShellClass =
  'impacto-settings executive-panel fixed left-1/2 top-1/2 z-50 flex w-full -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_48px_rgba(16,24,40,.22)]'

/**
 * Consulta: leitura contínua, mais estreita que o formulário.
 *
 * A altura acompanha o conteúdo até o limite da viewport. Um perfil de um
 * departamento só ocupa pouca coisa, e esticar o modal até a tela inteira para
 * mostrar três blocos curtos deixaria uma área branca sem função.
 */
export const consultModalClass =
  'max-w-[calc(100vw-24px)] max-h-[92vh] sm:max-h-[88vh] sm:w-[790px]'

/**
 * Formulário: altura FIXA, e não máxima.
 *
 * As três abas têm conteúdos de tamanhos muito diferentes, e com altura
 * variável o modal encolhia em Dados gerais e saltava em Acessos: as abas, o
 * rodapé e os botões trocavam de lugar a cada clique, e o alvo do mouse mudava
 * embaixo do cursor. Com altura fixa, trocar de aba não move nada, e apenas a
 * faixa central rola. O valor é o mesmo teto que a aba Acessos já alcançava.
 */
export const formModalClass = 'max-w-[calc(100vw-24px)] h-[92vh] sm:h-[88vh] sm:w-[920px]'

/* -------------------------------------------------------------------------- */
/* Indicadores do resumo                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Indicador do resumo, na mesma linguagem tipográfica da aba Usuários.
 *
 * Rótulo pequeno em caixa alta e número grande em fonte monoespaçada, sem
 * fundo, sem borda e sem ícone: é texto, e não um cartão de KPI. A cor mora só
 * no número e é o que diferencia um indicador do outro, sempre acompanhada do
 * rótulo escrito.
 */
export function SummaryStat({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: number
  valueClassName: string
}) {
  return (
    <div className="w-[176px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <div
        className="whitespace-nowrap text-[11.5px] font-semibold uppercase leading-4 text-[var(--settings-muted)]">{label}</div>
      <div className={`mt-0.5 font-mono text-[22px] font-semibold leading-7 ${valueClassName}`}>
        {value}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Avatar circular do usuário, idêntico ao da tabela de Usuários.
 *
 * As iniciais vêm gravadas na coleção, e a cor vem de `profileColorClasses`,
 * o mesmo mapa que a tabela usa: Administrador em azul, Executivo em azul
 * claro, Analista em verde. Nada é recalculado e nenhuma segunda paleta é
 * declarada aqui, porque um usuário com duas aparências em duas telas do mesmo
 * portal seria lido como dois usuários.
 *
 * O elemento é decorativo e fica fora da árvore de acessibilidade: o nome
 * inteiro e o Perfil do Sistema estão escritos ao lado.
 */
export function UserAvatar({
  initials,
  profile,
  size = 32,
}: {
  initials: string
  profile: string
  size?: number
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex flex-none items-center justify-center rounded-full font-bold ${profileColorClass(profile)}`}
      style={{ height: size, width: size, fontSize: Math.round(size * 0.34) }}
    >
      {initials}
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Perfil protegido                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Selo do Acesso do Sistema, o único Perfil de Acesso protegido pelo portal.
 *
 * Mora aqui porque aparece na faixa da página e no cabeçalho do modal de
 * consulta, e uma divergência entre os dois seria percebida na hora. O cadeado
 * diz que o perfil não é editável sem gastar uma linha de texto para isso; a
 * palavra continua escrita ao lado, então a leitura não depende do ícone.
 *
 * A cor vem de `systemManagedBadgeClass`, a mesma do label `Visão Geral
 * Executiva`: os dois são mantidos pelo portal.
 *
 * As medidas são próprias, e não as de `chipClass`, que é o formato dos badges
 * de Perfil do Sistema e continua intocado: aqui o selo divide a linha com o
 * nome do perfil e fica a um palmo dos labels de cobertura, então ele adota a
 * densidade deles, 11px e 22px de altura. Com o formato maior ele pesava mais
 * que o próprio nome do perfil.
 */
const systemBadgeShellClass =
  'inline-flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-[1.45]'

export function SystemBadge() {
  return (
    <span className={`${systemBadgeShellClass} ${systemManagedBadgeClass}`}>
      <Lock aria-hidden="true" size={10} />
      Sistema
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Estado da página                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Estado escrito, e não apenas colorido: quem não distingue as cores lê a mesma
 * informação. A página disponível não recebe selo nenhum, porque é o estado
 * normal e marcá-la encheria a lista de ruído.
 */
export function InDevelopmentBadge() {
  return (
    <span className={`${chipClass} flex-none bg-[var(--settings-tint)] font-medium text-[var(--settings-muted)]`}>
      Em desenvolvimento
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/* Caixa de seleção                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Caixa de seleção dos formulários visuais.
 *
 * Funciona de verdade, em estado local de quem a renderiza: é o que permite
 * avaliar a composição das telas. Nada do que ela marca é gravado.
 */
export function SelectionCheckbox({
  checked,
  label,
  onCheckedChange,
  trailing,
}: {
  checked: boolean
  label: ReactNode
  onCheckedChange: (checked: boolean) => void
  trailing?: ReactNode
}) {
  const id = useId()

  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <input
        checked={checked}
        className="h-4 w-4 flex-none cursor-pointer accent-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
        id={id}
        onChange={(event) => onCheckedChange(event.target.checked)}
        type="checkbox"
      />
      <label className="min-w-0 flex-1 cursor-pointer break-words text-[12.5px] text-[var(--text-secondary)]" htmlFor={id}>
        {label}
      </label>
      {trailing}
    </div>
  )
}
