import {CreateUserTypes, UpdateUserTypes, UserMessage, UserPasswordTypes, UserTypes} from "../../types/user/userTypes";
import {apiService} from "../apiService";
import {PaginatedResponse} from "../../types/pagination/paginationTypes";

class UserService {

    /*async getCurrentUser(): Promise<UserTypes> {
        return apiService.get<UserTypes>("v1/users/me");
    }*/

    async createUsers(payload: CreateUserTypes): Promise<UserTypes> {
        return apiService.post<UserTypes>("v1/users", payload)
    }

    async getUsersList(): Promise<PaginatedResponse<UserTypes>> {
        return apiService.get<PaginatedResponse<UserTypes>>("v1/users");
    }

    async getUserById(id: string): Promise<UserTypes> {
        return apiService.get<UserTypes>(`v1/users/${id}`);
    }

    async updateUser(id: string, payload: UpdateUserTypes): Promise<UserTypes> {
        return apiService.put<UserTypes>(`v1/users/${id}`, payload)
    }

    async resendEmail(id: string): Promise<string> {
        return apiService.get<string>(`v1/users/${id}/first-access`);
    }

    async changeUserPassword(id: string, payload: UserPasswordTypes): Promise<UserMessage> {
        return apiService.post<UserMessage>(`v1/users/${id}/password`, payload);
    }

    /*async deactivateUser(id: string): Promise<> {
        return apiService.put<>(`v1/users/${id}/deactivate`);
    }*/

    /*async activateUser(id: string): Promise<> {
        return apiService.put<>(`v1/users/${id}/activate`);
    }*/

}

export const userService = new UserService()