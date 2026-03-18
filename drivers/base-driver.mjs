// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey';
import { typedEntries, typedKeys } from "../lib/index.mjs";
const getArg = (capability) => {
    const [arg] = capability.split('.');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return arg;
};
export class BaseMELCloudDriver
// eslint-disable-next-line import-x/no-named-as-default-member
 extends Homey.Driver {
    consumedTagMapping = {};
    producedTagMapping = {};
    async onInit() {
        this.#setProducedAndConsumedTagMappings();
        this.#registerRunListeners();
        // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
        return Promise.resolve();
    }
    async onPair(session) {
        session.setHandler('showView', async (view) => {
            if (view === 'loading') {
                if (await this.#login()) {
                    await session.showView('list_devices');
                    return;
                }
                await session.showView('login');
            }
        });
        this.#handleLogin(session);
        session.setHandler('list_devices', async () => this.#discoverDevices());
        // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
        return Promise.resolve();
    }
    async onRepair(session) {
        this.#handleLogin(session);
        // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
        return Promise.resolve();
    }
    async #discoverDevices() {
        // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
        return Promise.resolve(this.homey.app.api.registry
            .getDevicesByType(this.type)
            .map(({ data, id, name }) => ({
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            capabilities: this.getRequiredCapabilities(data),
            capabilitiesOptions: this.getCapabilitiesOptions(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            data),
            data: { id },
            name,
        })));
    }
    #handleLogin(session) {
        session.setHandler('login', async (data) => this.#login(data));
    }
    async #login(data) {
        return this.homey.app.api.authenticate(data);
    }
    #registerActionRunListener(capability) {
        try {
            this.homey.flow
                .getActionCard(`${capability}_action`)
                .registerRunListener(async (args) => {
                await args.device.triggerCapabilityListener(capability, args[getArg(capability)]);
            });
        }
        catch { }
    }
    #registerConditionRunListener(capability) {
        try {
            this.homey.flow
                .getConditionCard(`${capability}_condition`)
                .registerRunListener((args) => {
                const value = 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                args.device.getCapabilityValue(capability);
                return typeof value === 'string' || typeof value === 'number' ?
                    value === args[getArg(capability)]
                    : value;
            });
        }
        catch { }
    }
    #registerRunListeners() {
        for (const capability of typedKeys({
            ...this.setCapabilityTagMapping,
            ...this.getCapabilityTagMapping,
            ...this.listCapabilityTagMapping,
        })) {
            this.#registerConditionRunListener(capability);
            if (capability in this.setCapabilityTagMapping) {
                this.#registerActionRunListener(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                capability);
            }
        }
    }
    #setProducedAndConsumedTagMappings() {
        for (const [capability, tags] of typedEntries(this.energyCapabilityTagMapping)) {
            const { consumed = [], produced = [] } = Object.groupBy(tags, (tag) => tag.endsWith('Consumed') ? 'consumed' : 'produced');
            this.consumedTagMapping[capability] = consumed;
            this.producedTagMapping[capability] = produced;
        }
    }
}
//# sourceMappingURL=base-driver.mjs.map