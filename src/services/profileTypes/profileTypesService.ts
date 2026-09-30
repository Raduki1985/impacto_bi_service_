import {PaginatedResponse} from "../../types/pagination/paginationTypes";
import {CoreProfileType} from "../../types/coreApi";
import {apiService} from "../apiService";

/** São três registros fixos; `size` alto evita depender da paginação. */
const PROFILE_TYPES_PAGE_SIZE = 100

class ProfileTypesService {

    /**
     * Cache de processo do catálogo.
     *
     * São três tipos de perfil fixos, lidos no cadastro de usuários a cada
     * abertura do formulário. Vivia em `accessProfileApi`, que deixou de existir.
     */
    private profileTypesCache: Promise<CoreProfileType[]> | null = null

    async getProfileTypes(): Promise<PaginatedResponse<CoreProfileType>> {
        return apiService.get<PaginatedResponse<CoreProfileType>>('v1/profile-types')
    }

    /**
     * Tipos de perfil (`profile_types`), já em cache.
     *
     * É o catálogo do campo Perfil do Sistema do cadastro de usuários, e a origem
     * do UUID que cada usuário aponta.
     */
    async listProfileTypes(): Promise<CoreProfileType[]> {
        // Um catálogo que falhou não pode ficar preso no cache: a tentativa
        // seguinte precisa poder chamar o serviço de novo.
        this.profileTypesCache ??= apiService
            .get<PaginatedResponse<CoreProfileType>>('v1/profile-types', {
                params: {size: PROFILE_TYPES_PAGE_SIZE},
            })
            .then((page) => page.list)
            .catch((cause: unknown) => {
                this.profileTypesCache = null
                throw cause
            })

        return this.profileTypesCache
    }

    clearProfileTypesCache(): void {
        this.profileTypesCache = null
    }
}

export const profileTypesService = new ProfileTypesService()
