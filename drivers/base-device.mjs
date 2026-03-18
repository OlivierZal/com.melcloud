var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
// eslint-disable-next-line import-x/no-extraneous-dependencies
import Homey from 'homey';
import { addToLogs } from "../decorators/add-to-logs.mjs";
import { isTotalEnergyKey, typedEntries } from "../lib/index.mjs";
import { withTimers } from "../mixins/with-timers.mjs";
import { EnergyReport } from "./base-report.mjs";
const DEBOUNCE_DELAY = 1000;
const modes = ['regular', 'total'];
const getErrorMessage = (error) => error instanceof Error ? error.message : String(error);
let BaseMELCloudDevice = (() => {
    let _classDecorators = [addToLogs('getName()')];
    let _classDescriptor;
    let _classExtraInitializers = [];
    let _classThis;
    let _classSuper = withTimers(Homey.Device);
    var BaseMELCloudDevice = class extends _classSuper {
        static { _classThis = this; }
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);
            BaseMELCloudDevice = _classThis = _classDescriptor.value;
            if (_metadata) Object.defineProperty(_classThis, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
            __runInitializers(_classThis, _classExtraInitializers);
        }
        #reports = {};
        #getCapabilityTagMapping = {};
        #setCapabilityTagMapping = {};
        #device;
        get id() {
            return this.getData().id;
        }
        get #listCapabilityTagMapping() {
            return this.cleanMapping(this.driver.listCapabilityTagMapping);
        }
        get #opCapabilityTagEntries() {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return typedEntries({
                ...this.#setCapabilityTagMapping,
                ...this.#getCapabilityTagMapping,
                ...this.#listCapabilityTagMapping,
            });
        }
        onDeleted() {
            this.#unscheduleReports();
        }
        async onInit() {
            this.capabilityToDevice = {
                onoff: (onoff) => this.getSetting('always_on') || onoff,
                ...this.capabilityToDevice,
            };
            await this.setWarning(null);
            this.#registerCapabilityListeners();
            await this.fetchDevice();
        }
        async onSettings({ changedKeys, newSettings, }) {
            const changedCapabilities = changedKeys.filter((setting) => this.#isCapability(setting) &&
                typeof newSettings[setting] === 'boolean');
            await this.#updateDeviceOnSettings({
                changedCapabilities,
                changedKeys,
                newSettings,
            });
            const changedEnergyKeys = changedCapabilities.filter((setting) => this.#isEnergyCapability(setting));
            if (changedEnergyKeys.length) {
                await this.#updateEnergyReportsOnSettings({
                    changedKeys: changedEnergyKeys,
                });
            }
        }
        async onUninit() {
            this.onDeleted();
            // eslint-disable-next-line unicorn/no-useless-promise-resolve-reject
            return Promise.resolve();
        }
        async addCapability(capability) {
            if (!this.hasCapability(capability)) {
                await super.addCapability(capability);
            }
        }
        async removeCapability(capability) {
            if (this.hasCapability(capability)) {
                await super.removeCapability(capability);
            }
        }
        async setWarning(error) {
            if (error !== null) {
                await super.setWarning(getErrorMessage(error));
            }
            await super.setWarning(null);
        }
        cleanMapping(capabilityTagMapping) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return Object.fromEntries(Object.entries(capabilityTagMapping).filter(([capability]) => this.hasCapability(capability)));
        }
        async fetchDevice() {
            try {
                if (!this.#device) {
                    this.#device = this.homey.app.getFacade('devices', this.id);
                    await this.#init(this.#device.data);
                }
                return this.#device;
            }
            catch (error) {
                await this.setWarning(error);
                return null;
            }
        }
        async syncFromDevice(data) {
            const newData = data ?? (await this.#fetchData());
            /* v8 ignore next */
            if (newData) {
                await this.setCapabilityValues(newData);
            }
        }
        async setCapabilityValues(data) {
            this.homey.api.realtime('deviceupdate', null);
            await Promise.all(this.#opCapabilityTagEntries.map(async ([capability, tag]) => {
                if (tag in data) {
                    await this.setCapabilityValue(capability, this.#convertFromDevice(capability, data[tag], data));
                }
            }));
        }
        #buildUpdateData(values) {
            this.log('Requested data:', values);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return Object.fromEntries(Object.entries(values).map(([capability, value]) => [
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                this.#setCapabilityTagMapping[capability],
                this.#convertToDevice(
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                capability, 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                value),
            ]));
        }
        #convertFromDevice(capability, value, data) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            return (this.deviceToCapability[capability]?.(value, data) ??
                value);
        }
        #convertToDevice(capability, value) {
            return (this.capabilityToDevice[capability]?.(
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            value) ?? value);
        }
        async #fetchData() {
            try {
                const device = await this.fetchDevice();
                return device?.data ?? null;
            }
            catch {
                await this.setWarning(this.homey.__(this.homey.__('errors.deviceNotFound')));
                return null;
            }
        }
        async #handleEnergyReports() {
            if (this.energyReportRegular) {
                this.#reports.regular = new EnergyReport(this, this.energyReportRegular);
                await this.#reports.regular.handle();
            }
            if (this.energyReportTotal) {
                this.#reports.total = new EnergyReport(this, this.energyReportTotal);
                await this.#reports.total.handle();
            }
        }
        async #handleOptionalCapabilities(newSettings, changedCapabilities) {
            for (const capability of changedCapabilities) {
                // eslint-disable-next-line no-await-in-loop
                await (newSettings[capability] === true ?
                    this.addCapability(capability)
                    : this.removeCapability(capability));
            }
        }
        async #init(data) {
            await this.#setCapabilities(data);
            await this.#setCapabilityOptions(data);
            await this.syncFromDevice(data);
            await this.#handleEnergyReports();
        }
        #isCapability(capability) {
            /* v8 ignore next */
            return (this.driver.manifest.capabilities ?? []).includes(capability);
        }
        #isEnergyCapability(capability) {
            return capability in this.driver.energyCapabilityTagMapping;
        }
        #isThermostatModeSupportingOff() {
            return this.thermostatMode !== null && 'off' in this.thermostatMode;
        }
        #registerCapabilityListeners() {
            this.registerMultipleCapabilityListener(Object.keys(this.driver.setCapabilityTagMapping), async (values) => {
                if ('thermostat_mode' in values &&
                    this.#isThermostatModeSupportingOff()) {
                    const isOn = values['thermostat_mode'] !== 'off';
                    values['onoff'] = isOn;
                    if (!isOn) {
                        delete values['thermostat_mode'];
                    }
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                await this.#set(values);
            }, DEBOUNCE_DELAY);
        }
        async #set(values) {
            const device = await this.fetchDevice();
            if (device) {
                const updateData = this.#buildUpdateData(values);
                if (Object.keys(updateData).length) {
                    try {
                        await device.setValues(updateData);
                    }
                    catch (error) {
                        if (!(error instanceof Error) || error.message !== 'No data to set') {
                            await this.setWarning(error);
                        }
                    }
                }
            }
        }
        async #setCapabilities(data) {
            const settings = this.getSettings();
            const currentCapabilities = new Set(this.getCapabilities());
            const requiredCapabilities = new Set([
                ...Object.keys(settings).filter((setting) => typeof settings[setting] === 'boolean' && settings[setting]),
                ...this.driver.getRequiredCapabilities(data),
            ].filter((capability) => this.#isCapability(capability)));
            for (const capability of currentCapabilities.symmetricDifference(requiredCapabilities)) {
                // eslint-disable-next-line no-await-in-loop
                await (requiredCapabilities.has(capability) ?
                    this.addCapability(capability)
                    : this.removeCapability(capability));
            }
            this.#setCapabilityTagMapping = this.cleanMapping(this.driver.setCapabilityTagMapping);
            this.#getCapabilityTagMapping = this.cleanMapping(this.driver.getCapabilityTagMapping);
        }
        async #setCapabilityOptions(data) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            for (const [capability, options] of Object.entries(this.driver.getCapabilitiesOptions(data))) {
                // eslint-disable-next-line no-await-in-loop
                await this.setCapabilityOptions(capability, options);
            }
        }
        #unscheduleReports() {
            for (const mode of modes) {
                this.#reports[mode]?.unschedule();
            }
        }
        async #updateDeviceOnSettings({ changedCapabilities, changedKeys, newSettings, }) {
            if (changedCapabilities.length) {
                await this.#handleOptionalCapabilities(newSettings, changedCapabilities);
                await this.setWarning(this.homey.__('warnings.dashboard'));
            }
            if (changedKeys.includes('always_on') && newSettings.always_on === true) {
                await this.triggerCapabilityListener('onoff', true);
                return;
            }
            if (changedKeys.some((setting) => setting !== 'always_on' &&
                !(setting in this.driver.energyCapabilityTagMapping))) {
                await this.syncFromDevice();
            }
        }
        async #updateEnergyReportsOnSettings({ changedKeys, }) {
            await Promise.all(modes.map(async (mode) => {
                if (changedKeys.some((setting) => isTotalEnergyKey(setting) === (mode === 'total'))) {
                    await this.#reports[mode]?.handle();
                }
            }));
        }
    };
    return BaseMELCloudDevice = _classThis;
})();
export { BaseMELCloudDevice };
//# sourceMappingURL=base-device.mjs.map