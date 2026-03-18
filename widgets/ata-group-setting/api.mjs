import { getBuildings } from "../../lib/index.mjs";
const api = {
    getAtaCapabilities({ homey: { app }, }) {
        return app.getAtaCapabilities();
    },
    async getAtaValues({ homey: { app }, params, query: { mode, status }, }) {
        return mode === 'detailed' ?
            app.getAtaDetailedValues(params, { status })
            : app.getAtaValues(params);
    },
    getBuildings({ query: { type }, }) {
        return getBuildings({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            type: type ? Number(type) : undefined,
        });
    },
    getLanguage({ homey: { i18n } }) {
        return i18n.getLanguage();
    },
    async setAtaValues({ body, homey: { app }, params, }) {
        return app.setAtaValues(body, params);
    },
};
export default api;
//# sourceMappingURL=api.mjs.map