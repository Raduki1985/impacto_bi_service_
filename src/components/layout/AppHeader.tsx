import {PageKey, pageTitles} from '../../Pages/Dashboard/pageConfig'
import type {PageSourceStatus} from '../../contexts/PageSourceStatusContextCore'
import {OS_SIMULATED_BADGE, OS_SIMULATED_EXPLANATION,} from '../../data/mockOsCatalog'

/**
 * Data de atualização exibida quando a página não informa a própria.
 *
 * Continua sendo a data das bases que já estavam publicadas: nenhuma página
 * atual muda de comportamento por causa da propriedade nova.
 */
const DEFAULT_UPDATED_AT = '01/06/2026'

/**
 * Páginas de OS que já leem a fonte real do SGI e, por isso, não carregam o
 * aviso de dados simulados.
 *
 * A Visão Geral entrou primeiro, com a base sanitizada; a Gestão de Técnicos
 * entrou em 21/09/2026, quando o ranking simulado deu lugar às visitas de
 * verdade. Manter o aviso numa página com dado real seria pior do que não ter
 * aviso nenhum: ensinaria o gestor a ignorá-lo.
 */
const REAL_SOURCE_PAGES: ReadonlySet<PageKey> = new Set<PageKey>(['overview', 'technicians'])

/**
 * Cor do ponto de cada estado da fonte.
 *
 * O ponto NUNCA é a única informação: o texto ao lado diz o mesmo em palavras,
 * e é ele que vale para quem não distingue as cores.
 */
const statusDotColor: Record<PageSourceStatus, string> = {
    ready: '#16a34a',
    loading: '#98a2b3',
    unavailable: '#e5484d',
}

type AppHeaderProps = {
    /** null identifica uma seção externa às páginas de OS (ex.: um departamento), que informa title/subtitle diretamente. */
    page: PageKey | null
    title?: string
    subtitle?: string
    /**
     * Data de atualização da base daquela página, no formato dd/mm/aaaa. Só quem
     * tem base própria informa; as demais mantêm a data padrão.
     */
    updatedAt?: string
    /**
     * Estado da fonte da página aberta. Só as páginas ligadas ao serviço de BI
     * informam algo diferente de `ready`; as demais leem base local e seguem
     * como sempre.
     */
    status?: PageSourceStatus
}

export function AppHeader({ page, title, subtitle, status = 'ready', updatedAt }: AppHeaderProps) {
  const [pageTitle, pageSubtitle] = page ? pageTitles[page] : [title ?? '', subtitle ?? '']
  const adminPage = page === 'users' || page === 'history'
  // Os controles de filtro saíram do cabeçalho: o painel da Visão Geral vive
  // dentro da própria página. O aviso obrigatório de dados simulados continua
  // nas páginas analíticas que seguem na simulação; as que já leem o SGI não
  // carregam aviso nenhum, sem espaço reservado no lugar. Os metadados da
  // fonte seguem em `overviewOsMeta.ts` para validação.
  const showSimulatedNotice = page !== null && !adminPage && !REAL_SOURCE_PAGES.has(page)

    return (
        <header className="flex-none border-b border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-end justify-between gap-5 px-[26px] pb-3 pt-4">
                <div>
                    <h1 className="text-[19px] font-bold tracking-normal text-[var(--text-heading)]">{pageTitle}</h1>
                    <p className="mt-0.5 text-[12.5px] text-[#98a2b3]">{pageSubtitle}</p>
                </div>
                {
                    /* Selo da fonte. Enquanto a página busca, ou quando o serviço não
                    responde, ele para de afirmar que o dado está atualizado: dizer
                    "Atualizado" com a tela mostrando erro é informação errada, não
                    detalhe visual. */
                }
                <div className="flex flex-none items-center gap-2 whitespace-nowrap text-xs text-[#98a2b3]">
                      <span
                          className="h-[7px] w-[7px] rounded-full"
                          style={{backgroundColor: statusDotColor[status]}}
                      />
                    {status === 'ready' ? `Atualizado · ${updatedAt ?? DEFAULT_UPDATED_AT}` : null}
                    {status === 'loading' ? 'Atualizando os dados' : null}
                    {status === 'unavailable' ? 'Dados indisponíveis' : null}
                </div>
            </div>
            {showSimulatedNotice ? (
                /* Aviso obrigatório da base simulada, na área compartilhada das
                   páginas analíticas de OS que seguem na simulação. A informação está
                   no TEXTO, não só na cor. */
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-[26px] pb-3 text-[11.5px] text-[#98a2b3]">
          <span
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#b45309]">
            {OS_SIMULATED_BADGE}
          </span>
                    <span>{OS_SIMULATED_EXPLANATION}</span>
                </p>
            ) : null}
        </header>
    )
}
