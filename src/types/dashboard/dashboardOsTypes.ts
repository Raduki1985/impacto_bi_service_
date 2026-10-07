export interface OverviewOsRecordResponse {
    readonly generatedAt: string
    readonly source: OverviewOsRecordSource
    readonly filters: DashboardOverviewOsFilters
    readonly count: string
    readonly records: OverviewOsRecordData[]
    readonly catalog: OverviewOsRecordCatalog
    readonly quality: OverviewOsRecordQuality
}

export interface OverviewOsRecordSource {
    readonly updatedAt: string
    readonly coverage: {
        readonly min: string
        readonly max: string
    }
}

export interface DashboardOverviewOsFilters {
    readonly dateFrom: string
    readonly dateTo: string
}

export interface OverviewOsRecordData {
    readonly id: string
    readonly name: string
    readonly period: string
    readonly technicianId: string
    readonly team: string
    readonly serviceType: string
    readonly category: string
    readonly city: string
    readonly status: string
    readonly statusKey: string
    readonly resolution: string
    readonly startedAt: string
    readonly finishedAt: string
    readonly travelMinutes: string
    readonly difficulty: string
    readonly unproductiveReason: string
}

export interface OverviewOsRecordCatalog {
    readonly technicians: OverviewOsRecordTechnicians[]
    readonly statuses: OverviewOsRecordStatuses[]
    readonly serviceTypes: OverviewOsRecordServiceTypes[]
}

export interface OverviewOsRecordTechnicians {
    readonly id: string
    readonly name: string
}

export interface OverviewOsRecordStatuses {
    readonly label: string
    readonly order: string
}

export interface OverviewOsRecordServiceTypes {
    readonly label: string
    readonly order: string
}

export interface OverviewOsRecordQuality {
    readonly recordsWithoutTeam: string
    readonly unclassifiedTechnicianIds: string[]
    readonly unmappedStatusKeys: string[]
    readonly unmappedServiceTypeKeys: string[]
    readonly unknownCities: string[]
}

/*----------------------------------------------------------------------------*/

export interface OverviewOsResponse {
    readonly generatedAt: string
    readonly source: OverviewOsSource
    readonly filters: OverviewOsFilters
    readonly options: OverviewOsOptions
    readonly catalog: OverviewOsCatalog
    readonly kpis: OverviewOsKpis
    readonly charts: OverviewOsCharts
    readonly quality: OverviewOsQuality
}

export interface OverviewOsSource {
    readonly updatedAt: string
    readonly coverage: {
        readonly min: string
        readonly max: string
    }
}

export interface OverviewOsFilters {
    readonly dateFrom: string
    readonly dateTo: string
    readonly team: string
    readonly technicianId: string
    readonly serviceType: string
    readonly category: string
    readonly city: string
    readonly status: string
}

export interface OverviewOsOptions {
    readonly teams: string[]
    readonly technicians: string[]
    readonly serviceTypes: string[]
    readonly categories: string[]
    readonly cities: string[]
    readonly statuses: string[]
}

export interface OverviewOsCatalog {
    readonly technicians: OverviewOsTechnicians[]
    readonly statuses: OverviewOsStatuses[]
    readonly serviceTypes: OverviewOsServiceTypes[]
}

export interface OverviewOsTechnicians {
    readonly id: string
    readonly name: string
}

export interface OverviewOsStatuses {
    readonly label: string
    readonly order: number
}

export interface OverviewOsServiceTypes {
    readonly label: string
    readonly order: number
}

export interface OverviewOsKpis {
    readonly total: number
    readonly completed: number
    readonly unproductive: number
    readonly completionRate: number
    readonly unproductiveRate: number
    readonly previous: {
        readonly range: {
            readonly dateFrom: string
            readonly dateTo: string
        }
        readonly coverage: string
        readonly total: number
        readonly completed: number
        readonly unproductive: number
    }
    readonly deltas: {
        readonly total: OverviewOsDelta
        readonly completed: OverviewOsDelta
        readonly completionRate: OverviewOsDelta
        readonly unproductiveRate: OverviewOsDelta
    }
}

export interface OverviewOsDelta {
    readonly rate: number
    readonly available: boolean
    readonly reason: string
}

export interface OverviewOsCharts {
    readonly daily: OverviewOsDaily[]
    readonly status: OverviewOsLabelCount[]
    readonly serviceTypes: OverviewOsServiceTypes[]
    readonly cities: OverviewOsLabelCount[]
    readonly categoriesTop: OverviewOsLabelCount[]
    readonly resolutionsTop: OverviewOsLabelCount[]
}

export interface OverviewOsDaily {
    readonly date: string
    readonly total: number
    readonly completed: number
    readonly unproductive: number
}

export interface OverviewOsServiceTypes {
    readonly label: string
    readonly count: number
    readonly categories: OverviewOsLabelCount[]
}

export interface OverviewOsLabelCount {
    readonly label: string
    readonly count: number
}

export interface OverviewOsQuality {
    readonly recordsWithoutTeam: number
    readonly unclassifiedTechnicianIds: string[]
    readonly unmappedStatusKeys: string[]
    readonly unmappedServiceTypeKeys: string[]
    readonly unknownCities: string[]
}
