import {CreateMenuTypes, MenuTreeTypes, MenuTypes, UpdateMenuTreeTypes} from "../../types/menu/menuTypes";
import {apiService} from "../apiService";
import {PaginatedResponse} from "../../types/pagination/paginationTypes";

class MenuService {

    async menuList(): Promise<PaginatedResponse<MenuTypes[]>> {
        return apiService.get<PaginatedResponse<MenuTypes[]>>("v1/profile-menus")
    }

    async createMenus(payload: CreateMenuTypes): Promise<MenuTypes> {
        return apiService.post<MenuTypes>("v1/profile-menus", payload);
    }

    async getMenuTree(): Promise<MenuTreeTypes> {
        return apiService.get<MenuTreeTypes>("v1/profile-menus/tree");
    }

    async getMenuById(id: string): Promise<MenuTypes> {
        return apiService.get<MenuTypes>(`v1/profile-menus/${id}`);
    }

    async updateMenu(id: string, payload: UpdateMenuTreeTypes): Promise<MenuTypes> {
        return apiService.put<MenuTypes>(`v1/profile-menus/${id}`, payload);
    }

    async deleteMenus(id: string): Promise<void> {
        return apiService.delete<void>(`v1/profile-menus/${id}`);
    }
}

export const menuService = new MenuService()