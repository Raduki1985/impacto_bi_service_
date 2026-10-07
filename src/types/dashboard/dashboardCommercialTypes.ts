export interface OverviewCommercialRecordResponse {
    readonly generatedAt: string
    readonly source: OverviewCommercialRecordSource
    readonly filters: OverviewCommercialRecordFilters
    readonly count: number
    readonly records: OverviewCommercialRecordData[]
    readonly quality: OverviewCommercialRecordQuality
}

export interface OverviewCommercialRecordSource {
    readonly updatedAt: string
    readonly saleRule: string
}

export interface OverviewCommercialRecordFilters {
    readonly dateFrom: string
    readonly dateTo: string
    readonly includeQueue: boolean
    readonly queueFrom: string
}

export interface OverviewCommercialRecordData {
    readonly id: string
    readonly status: string
    readonly statusKey: string
    readonly stage: string
    readonly activated: boolean
    readonly contractedOn: string
    readonly signedOn: string
    readonly createdAt: string
    readonly startedOn: string
    readonly startedAt: string
    readonly monthlyValue: number
    readonly planName: string
    readonly cityId: string
    readonly cityLabel: string
    readonly sellerId: string
    readonly sellerName: string
    readonly team: string
    readonly teams: string[]
    readonly indicated: boolean
    readonly customerKind: string
    readonly personType: string
    readonly hasOpenOrder: boolean
    readonly hasInstallationOrder: boolean
    readonly hasUnproductiveOrder: boolean
    readonly nextVisitOn: string
    readonly lastVisitOn: string
    readonly lastOrderStatus: string
    readonly signalEvidence: string[]
    readonly replacedBy: string
}

export interface OverviewCommercialRecordQuality {
    readonly salesWithoutTeam: number
    readonly sellersWithoutTeam: string[]
    readonly unmappedTeamNames: string[]
    readonly unmappedStatusKeys: string[]
    readonly unknownCities: string[]
}

/*----------------------------------------------------------------------------*/

export interface OverviewCommercialResponse {
    readonly generatedAt: string
    readonly source: OverviewCommercialSource
    readonly filters: OverviewCommercialFilters
    readonly catalog: OverviewCommercialCatalog
    readonly metrics: OverviewCommercialMetrics
    readonly previous: OverviewCommercialPrevious
}

export interface OverviewCommercialSource {
    readonly updatedAt: string
    readonly period: {
        readonly start: string
        readonly end: string
    }
    readonly months: string[]
    readonly saleRule: string
}

export interface OverviewCommercialFilters {
    readonly startDate: string
    readonly endDate: string
    readonly cityId: string
    readonly team: string
    readonly sellerId: string
    readonly personType: string
}

export interface OverviewCommercialCatalog {
    readonly cities: OverviewCommercialCities[]
    readonly sellers: OverviewCommercialSellers[]
    readonly personTypes: OverviewCommercialPersonTypes[]
}

export interface OverviewCommercialCities {
    readonly id: string
    readonly name: string
}

export interface OverviewCommercialSellers {
    readonly id: string
    readonly name: string
}

export interface OverviewCommercialPersonTypes {
    readonly id: string
    readonly name: string
}

export interface OverviewCommercialMetrics {
    readonly totalContracts: number
    readonly activeSales: number
    readonly activeSalesSoldEarlier: number
    readonly activationRate: number
    readonly commercialSales: number
    readonly corporateSales: number
    readonly indicatedSales: number
    readonly sellerSales: number
    readonly monthlyRevenue: number
    readonly averageTicket: number
    readonly pipelineSales: number
    readonly soldContracts: number
    readonly awaitingActivation: number
    readonly goal: number
    readonly superGoal: number
    readonly goalAchieved: number
    readonly superGoalAchieved: number
    readonly activationDaysMedian: number
    readonly activationDaysP90: number
}

export interface OverviewCommercialPrevious {
    readonly range: {
        readonly startDate: string
        readonly endDate: string
    }
    readonly activeSales: number
    readonly monthlyRevenue: number
    readonly goalAchieved: number
    readonly superGoalAchieved: number
    readonly newCustomers: number
    readonly activationDaysMedian: number
    readonly maturity: OverviewCommercialMaturity
}

export interface OverviewCommercialMaturity {
    readonly days: number
    readonly activatedFrom: string
    readonly activatedTo: string
    readonly sales: number
    readonly blocked: number
    readonly cancelled: number
}
