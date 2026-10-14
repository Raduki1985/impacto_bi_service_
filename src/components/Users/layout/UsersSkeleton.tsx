import {SkeletonBlock} from "../../dashboard/PageSkeleton";
import {DataTable} from "../../dashboard/DataTable";

const SKELETON_CELL_WIDTHS = ['w-4/5', 'w-3/5', 'w-2/3', 'w-1/2', 'w-3/4']

function SkeletonKpi() {
    return (
        <div
            className="w-[148px] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            data-skeleton="kpi"
        >
            <div className="flex h-[15px] items-center">
                <SkeletonBlock className="h-2.5 w-3/4"/>
            </div>
            <div className="mt-1 flex h-[28px] items-center">
                <SkeletonBlock className="h-5 w-1/2"/>
            </div>
        </div>
    )
}

function SkeletonKpiStrip() {
    return (
        <div
            className="flex flex-none flex-wrap items-stretch w-fit rounded-xl border border-[var(--border)] bg-[var(--settings-tint)] p-3 gap-x-5 gap-y-2.5">
            <div className="flex gap-2.5">
                {Array.from({length: 4}, (_, index) => <SkeletonKpi key={index}/>)}
            </div>
            <div className="flex gap-2.5">
                {Array.from({length: 3}, (_, index) => <SkeletonKpi key={index}/>)}
            </div>
        </div>
    )
}

function SkeletonRows({canManageUsers, rows}: { canManageUsers: boolean; rows: number }) {
    return (
        <>
            {Array.from({length: rows}, (_, rowIndex) => (
                <tr className="border-t border-[var(--divider)]" data-skeleton="users-row" key={rowIndex}>
                    <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full"/>
                            <div className="min-w-0 flex-1">
                                <SkeletonBlock className="h-3 w-2/5"/>
                                <SkeletonBlock className="mt-1.5 h-2.5 w-3/5"/>
                            </div>
                        </div>
                    </td>

                    {[1, 2, 3, 4].map((columnIndex) => (
                        <td className="px-4 py-2.5" key={columnIndex}>
                            <SkeletonBlock
                                className={`h-3 ${SKELETON_CELL_WIDTHS[(rowIndex + columnIndex) % SKELETON_CELL_WIDTHS.length]}`}
                            />
                        </td>
                    ))}

                    {canManageUsers ? (
                        <td className="px-4 py-2.5">
                            <div className="flex justify-end gap-1.5">
                                {Array.from({length: 4}, (_, index) => (
                                    <SkeletonBlock className="h-[30px] w-[30px] rounded" key={index}/>
                                ))}
                            </div>
                        </td>
                    ) : null}
                </tr>
            ))}
        </>
    )
}

function SkeletonPagination() {
    return (
        <div
            className="mt-auto flex flex-none flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--settings-tint)] px-4 py-2.5 text-[12.5px]"
            data-skeleton="pagination"
        >
            <div className="flex h-9 items-center">
                <SkeletonBlock className="h-3 w-48"/>
            </div>

            <div className="flex gap-1.5">
                <SkeletonBlock className="h-9 w-[74px] rounded-md"/>
                <SkeletonBlock className="h-9 w-9 rounded-md"/>
                <SkeletonBlock className="h-9 w-[78px] rounded-md"/>
            </div>
        </div>
    )
}

export function UsersSkeleton({canManageUsers, columnWidths, headers, rows}: {
    canManageUsers: boolean
    columnWidths: Array<string | undefined>
    headers: string[]
    rows: number
}) {
    return (
        <div aria-live="polite" className="flex min-h-0 flex-1 flex-col" role="status">
            <span className="sr-only">Carregando os usuários</span>

            <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-4">
                <SkeletonKpiStrip/>

                <div className="min-h-0 flex-1">
                    <DataTable columnWidths={columnWidths} headers={headers} minWidth={960} scrollY>
                        <SkeletonRows canManageUsers={canManageUsers} rows={rows}/>
                    </DataTable>
                </div>

                <SkeletonPagination/>
            </div>
        </div>
    )
}
