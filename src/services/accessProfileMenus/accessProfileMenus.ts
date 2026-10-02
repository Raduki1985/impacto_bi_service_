import {CreateUserAccessProfileTypes, UserAccessProfileTypes} from "../../types/accessProfile/accessProfileTypes";
import {apiService} from "../apiService";
import {PaginatedResponse} from "../../types/pagination/paginationTypes";

class AccessProfileMenus {

    async createUserAccessProfile(payload: CreateUserAccessProfileTypes): Promise<UserAccessProfileTypes> {
        return apiService.post<UserAccessProfileTypes>("v1/access-profile-menus", payload)
    }

    async getUsersAccessProfiles(): Promise<PaginatedResponse<UserAccessProfileTypes[]>> {
        return apiService.get<PaginatedResponse<UserAccessProfileTypes[]>>("v1/access-profile-menus")
    }

    async getUserAccessProfileById(accessId: string, profileMenuId: string): Promise<UserAccessProfileTypes> {
        return apiService.get<UserAccessProfileTypes>(`v1/access-profile-menus/${accessId}/${profileMenuId}`)
    }

    async deleteUserAccessProfile(accessId: string, profileMenuId: string): Promise<void> {
        return apiService.delete<void>(`v1/access-profile-menus/${accessId}/${profileMenuId}`)
    }
}

export const accessProfileMenus = new AccessProfileMenus()