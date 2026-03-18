const state = {};
const getFacadeManager = () => {
    const { facadeManager } = state;
    if (!facadeManager) {
        throw new Error('FacadeManager has not been initialized');
    }
    return facadeManager;
};
export const setFacadeManager = (value) => {
    state.facadeManager = value;
};
export const getBuildings = ({ type, } = {}) => getFacadeManager().getBuildings({ type });
export const getZones = ({ type } = {}) => getFacadeManager().getZones({ type });
//# sourceMappingURL=get-zones.mjs.map