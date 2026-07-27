import type { PageKey } from '../../Pages/Dashboard/pageConfig'
import { pageTitles } from '../../Pages/Dashboard/pageConfig'
import { FilterBar } from './FilterBar'

type AppHeaderProps = {
  /** null identifica uma seção externa às páginas de OS (ex.: um departamento), que informa title/subtitle diretamente. */
  page: PageKey | null
  title?: string
  subtitle?: string
}

export function AppHeader({ page, title, subtitle }: AppHeaderProps) {
  const [pageTitle, pageSubtitle] = page ? pageTitles[page] : [title ?? '', subtitle ?? '']
  const adminPage = page === 'users' || page === 'permissions'
  const showFilters = page !== null && !adminPage

  return (
    <header className="flex-none border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-end justify-between gap-5 px-[26px] pb-3 pt-4">
        <div>
          <h1 className="text-[19px] font-bold tracking-normal text-[var(--text-heading)]">{pageTitle}</h1>
          <p className="mt-0.5 text-[12.5px] text-[#98a2b3]">{pageSubtitle}</p>
        </div>
        <div className="flex flex-none items-center gap-2 whitespace-nowrap text-xs text-[#98a2b3]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#16a34a]" />
          Atualizado · 01/06/2026
        </div>
      </div>
      {showFilters ? <FilterBar /> : null}
    </header>
  )
}
