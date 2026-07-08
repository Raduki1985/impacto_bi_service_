import type { PageKey } from '../../Pages/Dashboard/pageConfig'
import { pageTitles } from '../../Pages/Dashboard/pageConfig'
import { FilterBar } from './FilterBar'

type AppHeaderProps = {
  page: PageKey
}

export function AppHeader({ page }: AppHeaderProps) {
  const [title, subtitle] = pageTitles[page]
  const adminPage = page === 'users' || page === 'permissions'

  return (
    <header className="flex-none border-b border-[#e4e7ee] bg-white">
      <div className="flex items-end justify-between gap-5 px-[26px] pb-3 pt-4">
        <div>
          <h1 className="text-[19px] font-bold tracking-normal text-[#101828]">{title}</h1>
          <p className="mt-0.5 text-[12.5px] text-[#98a2b3]">{subtitle}</p>
        </div>
        <div className="flex flex-none items-center gap-2 whitespace-nowrap text-xs text-[#98a2b3]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#16a34a]" />
          Atualizado · 01/06/2026
        </div>
      </div>
      {!adminPage ? <FilterBar /> : null}
    </header>
  )
}
