export interface PaginationInfo {
    total: number;
    size: number;
    current: number;
    pages: number;
    previous: boolean,
    next: boolean;
}

export interface PaginatedResponse<T> {
    list: T[];
    pagination: PaginationInfo;
}