export interface ProfileTypesTypes {
    id: string
    code: string
    name: string
    createdAt: string
    updatedAt: string
}

export interface UserProfileTypesResponse {
    id: string
    code: string
    name: string
}

export interface CreateProfileTypes {
    code: string
    name: string
}

export interface UpdateProfileTypes {
    code: string
    name: string
}