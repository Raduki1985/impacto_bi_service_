import pkg from "../package.json";

export const Config = {
    APP_VERSION: `${pkg.version}${import.meta.env.MODE !== "production" ? "-dev" : ""}`,
    API_BASE_URL: (import.meta.env.VITE_BI_API_URL as string),
};
