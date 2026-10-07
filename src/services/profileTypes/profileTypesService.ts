import {PaginatedResponse} from "../../types/pagination/paginationTypes";
import {apiService} from "../apiService";
import {LIST_PAGE_SIZE} from "../../config/pagination";
import {CreateProfileTypes, ProfileTypesTypes, UpdateProfileTypes} from "../../types/profileTypes/profileTypesType";


class ProfileTypesService {

    async listProfileTypes(): Promise<PaginatedResponse<ProfileTypesTypes>> {
        return apiService.get<PaginatedResponse<ProfileTypesTypes>>('v1/profile-types', {
            params: {page: 1, size: LIST_PAGE_SIZE},
        })
    }

    async createProfileType(payload: CreateProfileTypes): Promise<ProfileTypesTypes> {
        return apiService.post<ProfileTypesTypes>('v1/profile-types', payload)
    }

    async getProfileTypeById(id: string): Promise<ProfileTypesTypes> {
        return apiService.get<ProfileTypesTypes>(`v1/profile-types/${id}`)
    }

    async updateProfileType(id: string, payload: UpdateProfileTypes): Promise<ProfileTypesTypes> {
        return apiService.put<ProfileTypesTypes>(`v1/profile-types/${id}`, payload)
    }

    async deleteProfileType(id: string): Promise<void> {
        return apiService.delete<void>(`v1/profile-types/${id}`)
    }

}

export const profileTypesService = new ProfileTypesService()
