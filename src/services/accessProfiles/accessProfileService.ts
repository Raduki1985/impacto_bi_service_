import type {PaginatedResponse} from "../../types/pagination/paginationTypes";
import {apiService} from "../apiService";
import {LIST_PAGE_SIZE} from "../../config/pagination";
import {
    AccessProfileTypes,
    CreateAccessProfileTypes,
    UpdateAccessProfileTypes
} from "../../types/accessProfile/accessProfileTypes";

type ListAccessProfilesParams = {
    page?: number
    size?: number
    search?: string
}

class AccessProfileService {

    async listAccessProfiles(params: ListAccessProfilesParams = {}): Promise<PaginatedResponse<AccessProfileTypes>> {
        const {page = 1, size = LIST_PAGE_SIZE, search} = params

        return apiService.get<PaginatedResponse<AccessProfileTypes>>("v1/access", {
            params: {page, size, search: search?.trim() || undefined},
        })
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
