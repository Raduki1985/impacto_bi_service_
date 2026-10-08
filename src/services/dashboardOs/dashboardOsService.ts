import {
    DashboardOverviewOsFilters,
    OverviewOsFilters,
    OverviewOsRecordResponse,
    OverviewOsResponse
} from "../../types/dashboard/dashboardOsTypes";
import {apiService} from "../apiService";

class DashboardOsService {

    async getOverviewRecords(filter: DashboardOverviewOsFilters | null): Promise<OverviewOsRecordResponse> {
        return apiService.get<OverviewOsRecordResponse>("v1/bi/os/overview/records",
            filter === null
                ? {}
                : {params: {date_from: filter?.dateFrom, date_to: filter?.dateTo}},
        )
    }

    async getOverview(filter: OverviewOsFilters | null): Promise<OverviewOsResponse> {
        return apiService.get<OverviewOsResponse>("v1/bi/os/overview",
            filter === null
                ? {}
                : {
                    params: {
                        date_from: filter?.dateFrom,
                        date_to: filter?.dateTo,
                        team: filter?.team,
                        technicianId: filter?.technicianId,
                        serviceType: filter?.serviceType,
                        category: filter?.category,
                        city: filter?.city,
                        status: filter?.status,
                    }
                },
        )
    }
}

export const dashboardOsService = new DashboardOsService()
