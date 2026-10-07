import {apiService} from "../apiService";
import {
    OverviewCommercialFilters,
    OverviewCommercialRecordFilters,
    OverviewCommercialRecordResponse,
    OverviewCommercialResponse
} from "../../types/dashboard/dashboardCommercialTypes";

class DashboardCommercialService {
    async getCommercialOverviewRecords(filter: OverviewCommercialRecordFilters | null): Promise<OverviewCommercialRecordResponse> {
        return apiService.get<OverviewCommercialRecordResponse>("v1/bi/comercial/overview/records",
            filter === null
                ? {}
                : {
                    params: {
                        date_from: filter?.dateFrom,
                        date_to: filter?.dateTo,
                        includeQueue: filter?.includeQueue,
                        queueFrom: filter?.queueFrom,
                    }
                },
        )
    }

    async getCommercialOverview(filter: OverviewCommercialFilters | null): Promise<OverviewCommercialResponse> {
        return apiService.get<OverviewCommercialResponse>("v1/bi/comercial/overview",
            filter === null
                ? {}
                : {
                    params: {
                        startDate: filter?.startDate,
                        endDate: filter?.endDate,
                        cityId: filter?.cityId,
                        team: filter?.team,
                        sellerId: filter?.sellerId,
                        personType: filter?.personType,
                    }
                },
        )
    }
}

export const dashBoardCommercial = new DashboardCommercialService()