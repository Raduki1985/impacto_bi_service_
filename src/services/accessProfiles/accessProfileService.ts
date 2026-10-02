import type {PaginatedResponse} from "../../types/pagination/paginationTypes";
import {apiService} from "../apiService";
import {
    AccessProfileTypes,
    CreateAccessProfileTypes,
    UpdateAccessProfileTypes
} from "../../types/accessProfile/accessProfileTypes";

class AccessProfileService {

    async listAccessProfiles(): Promise<PaginatedResponse<AccessProfileTypes>> {
        return apiService.get<PaginatedResponse<AccessProfileTypes>>("v1/access")
    }

    async getAccessProfile(id: string): Promise<AccessProfileTypes> {
        return apiService.get<AccessProfileTypes>(`v1/access/${id}`)
    }

    async createAccessProfile(payload: CreateAccessProfileTypes): Promise<AccessProfileTypes> {
        return apiService.post<AccessProfileTypes>("v1/access", payload)
    }

    async updateAccessProfile(id: string, payload: UpdateAccessProfileTypes): Promise<AccessProfileTypes> {
        return apiService.put<AccessProfileTypes>(`v1/access/${id}`, payload)
    }

    async deleteAccessProfile(id: string): Promise<void> {
        return apiService.delete<void>(`v1/access/${id}`)
    }

}

export const accessProfileService = new AccessProfileService()
