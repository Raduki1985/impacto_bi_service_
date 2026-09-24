import {Briefcase, type LucideIcon} from 'lucide-react'
import {useLocation, useNavigate} from 'react-router-dom'

import {navigationGroups, PageKey} from '../../Pages/Dashboard/pageConfig'
import {COMMERCIAL_ACCESS_PERMISSION, commercialOverviewPath} from '../../Pages/Commercial/pageConfig'
import {useAuth} from '../../contexts/useAuth'
import {cn} from '../../lib/utils'

type AppNavigationProps = {
    /** null quando a seção ativa não é uma página de OS (ex.: um departamento) — nenhum item fica destacado. */
    activePage: PageKey | null
    onPageChange: (page: PageKey) => void
}

type NavigationItem = {
    key: PageKey
    label: string
    icon: LucideIcon
}

const navButtonClass =
    'flex h-9 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-[#475467] transition hover:bg-[#f3f5f9]'

export function AppNavigation({activePage, onPageChange}: AppNavigationProps) {
    const {hasPermission} = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const items = navigationGroups.reduce<NavigationItem[]>(
        (acc, group) => [...acc, ...group.items],
        [],
    )

    const commercialActive = location.pathname.startsWith('/dashboard/comercial')

    return (
        <nav className="flex flex-wrap items-center gap-1 px-4 py-2">
            {items.map((item) => {
                const Icon = item.icon
                const active = activePage === item.key

                return (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => onPageChange(item.key)}
                        className={cn(navButtonClass, active && 'bg-[var(--accent-weak)] font-semibold text-[var(--accent)]')}
                    >
                        <Icon size={15} aria-hidden="true"/>
                        {item.label}
                    </button>
                )
            })}
            {hasPermission(COMMERCIAL_ACCESS_PERMISSION) ? (
                <button
                    type="button"
                    onClick={() => navigate(commercialOverviewPath)}
                    className={cn(navButtonClass, commercialActive && 'bg-[var(--accent-weak)] font-semibold text-[var(--accent)]')}
                >
                    <Briefcase size={15} aria-hidden="true"/>
                    Comercial
                </button>
            ) : null}
        </nav>
    )
}
