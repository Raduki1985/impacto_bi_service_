import type {
    CoreProfileMenu,
    CoreProfileMenuCreate,
    CoreProfileMenuTree,
    CoreProfileMenuUpdate
} from "../../types/coreApi";
import {apiService} from "../apiService";

class ProfileMenuService {

    /**
     * Cache de processo da árvore de menus.
     *
     * A árvore é consultada em toda leitura e em toda gravação de Perfil de
     * Acesso, e quase nunca muda. O cache vive só enquanto a aba está aberta: um
     * F5 o descarta inteiro. Estava em `accessProfileApi`, que deixou de existir.
     */
    private menuTreeCache: Promise<CoreProfileMenuTree[]> | null = null

    async fetchProfileMenuTree(): Promise<CoreProfileMenuTree[]> {
        // Um catálogo que falhou não pode ficar preso no cache: a tentativa
        // seguinte precisa poder chamar o serviço de novo.
        this.menuTreeCache ??= apiService
            .get<CoreProfileMenuTree[]>('v1/profile-menus/tree')
            .catch((cause: unknown) => {
                this.menuTreeCache = null
                throw cause
            })

        return this.menuTreeCache
    }

    /**
     * Descarta a árvore em cache. É o que a aba Menu Itens chama depois de toda
     * gravação: sem isso, um menu recém-cadastrado continuaria invisível para o
     * formulário de Perfis de Acesso até alguém recarregar a página.
     */
    clearMenuTreeCache(): void {
        this.menuTreeCache = null
    }

    async createProfileMenuOnApi(payload: CoreProfileMenuCreate): Promise<CoreProfileMenu> {
        return apiService.post<CoreProfileMenu>('v1/profile-menus', payload)
    }

    async updateProfileMenuOnApi(
        id: string,
        payload: CoreProfileMenuUpdate,
    ): Promise<CoreProfileMenu> {
        return apiService.put<CoreProfileMenu>(`v1/profile-menus/${id}`, payload)
    }


    async deleteProfileMenuOnApi(id: string): Promise<void> {
        return apiService.delete<void>(`v1/profile-menus/${id}`)
    }
}

export const profileMenuService = new ProfileMenuService()
