import {CoreUser, CoreUserCreate, CoreUserPasswordChange, CoreUserUpdate} from "../../types/coreApi";
import {apiService} from "../apiService";

class UsersService {

    async getMe(): Promise<CoreUser[]> {
        return apiService.get<CoreUser[]>("v1/users/me");
    }

    async getUserList(): Promise<CoreUser[]> {
        return apiService.get<CoreUser[]>("v1/users");
    }

    async updatedMe(): Promise<CoreUser> {
        return apiService.put<CoreUser>("v1/users/me")
    }

    async createUser(payload: CoreUserCreate): Promise<CoreUser> {
        return apiService.post<CoreUser>("v1/users", payload)
    }

    async updateUser(id: string, payload: CoreUserUpdate): Promise<CoreUser> {
        return apiService.put<CoreUser>(`v1/users/${id}`, payload)
    }

    async changeUserPassword(id: string, payload: CoreUserPasswordChange): Promise<{ message: string }> {
        return apiService.post<{ message: string }>(`v1/users/${id}/password`, payload)
    }

    async resendEmail(id: string): Promise<{ message: string }> {
        return apiService.post<{ message: string }>(`v1/users/${id}/first-access`)
    }
}

export const usersService = new UsersService()