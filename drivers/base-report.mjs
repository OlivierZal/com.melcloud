import { DateTime, } from 'luxon';
import { isTotalEnergyKey, typedEntries } from "../lib/index.mjs";
const K_MULTIPLIER = 1000;
const DEFAULT_ZERO = 0;
const DEFAULT_DIVISOR_ONE = 1;
const DEFAULT_DEVICE_COUNT_ONE = 1;
const sumTags = (data, tags) => tags.reduce((accumulator, tag) => accumulator + Number(data[tag]), DEFAULT_ZERO);
export class EnergyReport {
    #config;
    #device;
    #homey;
    driver;
    #linkedDeviceCount = DEFAULT_DEVICE_COUNT_ONE;
    #reportTimeout = null;
    #reportInterval;
    constructor(device, config) {
        this.#device = device;
        this.#config = config;
        ({ driver: this.driver, homey: this.#homey } = this.#device);
    }
    get #energyCapabilityTagEntries() {
        return typedEntries(this.#device.cleanMapping(this.driver.energyCapabilityTagMapping)).filter(([capability]) => isTotalEnergyKey(capability) === (this.#config.mode === 'total'));
    }
    async handle() {
        if (!this.#energyCapabilityTagEntries.length) {
            this.unschedule();
            return;
        }
        await this.#get();
        this.#schedule();
    }
    unschedule() {
        this.#homey.clearTimeout(this.#reportTimeout);
        this.#reportTimeout = null;
        this.#homey.clearInterval(this.#reportInterval);
        this.#device.log(`${this.#config.mode} energy report has been cancelled`);
    }
    #calculateCopValue(data, capability) {
        const { driver: { producedTagMapping: { [capability]: producedTags = [] }, }, } = this;
        const { driver: { consumedTagMapping: { [capability]: consumedTags = [] }, }, } = this;
        return (sumTags(data, producedTags) /
            (sumTags(data, consumedTags) || DEFAULT_DIVISOR_ONE));
    }
    #calculateEnergyValue(data, tags) {
        return sumTags(data, tags) / this.#linkedDeviceCount;
    }
    #calculatePowerValue(data, tags, hour) {
        let total = DEFAULT_ZERO;
        for (const tag of tags) {
            const { [tag]: tagData } = data;
            if (Array.isArray(tagData)) {
                total += (tagData[hour] ?? DEFAULT_ZERO) * K_MULTIPLIER;
            }
        }
        return total / this.#linkedDeviceCount;
    }
    async #get() {
        const device = await this.#device.fetchDevice();
        if (device) {
            try {
                const toDateTime = DateTime.now().minus(this.#config.minus);
                const to = toDateTime.toISODate();
                await this.#set(await device.getEnergy({
                    from: this.#config.mode === 'total' ? undefined : to,
                    to,
                }), toDateTime.hour);
            }
            catch { }
        }
    }
    #schedule() {
        if (!this.#reportTimeout) {
            const actionType = `${this.#config.mode} energy report`;
            this.#reportTimeout = this.#device.setTimeout(async () => {
                await this.handle();
                this.#reportInterval = this.#device.setInterval(async () => this.handle(), this.#config.interval, actionType);
            }, DateTime.now()
                .plus(this.#config.duration)
                .set(this.#config.values)
                .diffNow(), actionType);
        }
    }
    async #set(data, hour) {
        if ('UsageDisclaimerPercentages' in data) {
            ;
            ({ length: this.#linkedDeviceCount } =
                data.UsageDisclaimerPercentages.split(','));
        }
        await Promise.all(this.#energyCapabilityTagEntries.map(async ([capability, tags]) => {
            if (capability.includes('cop')) {
                await this.#device.setCapabilityValue(capability, 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                this.#calculateCopValue(data, capability));
                return;
            }
            if (capability.startsWith('measure_power')) {
                await this.#device.setCapabilityValue(capability, 
                // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
                this.#calculatePowerValue(data, tags, hour));
                return;
            }
            await this.#device.setCapabilityValue(capability, 
            // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
            this.#calculateEnergyValue(data, tags));
        }));
    }
}
//# sourceMappingURL=base-report.mjs.map