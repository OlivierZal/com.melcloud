import { getZones } from "../../lib/index.mjs";
const api = {
    getDevices({ query: { type }, }) {
        return getZones({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            type: type ? Number(type) : undefined,
        }).filter((zone) => zone.model === 'devices');
    },
    async getHourlyTemperatures({ homey: { app }, params: { deviceId }, query: { hour }, }) {
        return app.getHourlyTemperatures(deviceId, 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        hour === undefined ? undefined : Number(hour));
    },
    getLanguage({ homey: { i18n } }) {
        return i18n.getLanguage();
    },
    async getOperationModes({ homey: { app }, params: { deviceId }, query: { days }, }) {
        return app.getOperationModes(deviceId, Number(days));
    },
    async getSignal({ homey: { app }, params: { deviceId }, query: { hour }, }) {
        return app.getSignal(deviceId, 
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        hour === undefined ? undefined : Number(hour));
    },
    async getTemperatures({ homey: { app }, params: { deviceId }, query: { days }, }) {
        return app.getTemperatures(deviceId, Number(days));
    },
};
export default api;
//# sourceMappingURL=api.mjs.map