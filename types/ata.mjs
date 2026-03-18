export const ThermostatModeAta = {
    auto: 'auto',
    cool: 'cool',
    dry: 'dry',
    fan: 'fan',
    heat: 'heat',
    off: 'off',
};
export const setCapabilityTagMappingAta = {
    fan_speed: 'SetFanSpeed',
    horizontal: 'VaneHorizontal',
    onoff: 'Power',
    target_temperature: 'SetTemperature',
    thermostat_mode: 'OperationMode',
    vertical: 'VaneVertical',
};
export const getCapabilityTagMappingAta = {
    'alarm_generic.silent': 'SetFanSpeed',
    measure_temperature: 'RoomTemperature',
};
export const listCapabilityTagMappingAta = {
    'alarm_generic.silent': 'FanSpeed',
    fan_speed: 'FanSpeed',
    'fan_speed.state': 'ActualFanSpeed',
    horizontal: 'VaneHorizontalDirection',
    measure_signal_strength: 'WifiSignalStrength',
    'measure_temperature.outdoor': 'OutdoorTemperature',
    vertical: 'VaneVerticalDirection',
};
export const energyCapabilityTagMappingAta = {
    measure_power: ['Auto', 'Cooling', 'Dry', 'Fan', 'Heating', 'Other'],
    'measure_power.auto': ['Auto'],
    'measure_power.cooling': ['Cooling'],
    'measure_power.dry': ['Dry'],
    'measure_power.fan': ['Fan'],
    'measure_power.heating': ['Heating'],
    'measure_power.other': ['Other'],
    meter_power: [
        'TotalAutoConsumed',
        'TotalCoolingConsumed',
        'TotalDryConsumed',
        'TotalFanConsumed',
        'TotalHeatingConsumed',
        'TotalOtherConsumed',
    ],
    'meter_power.auto': ['TotalAutoConsumed'],
    'meter_power.cooling': ['TotalCoolingConsumed'],
    'meter_power.daily': [
        'TotalAutoConsumed',
        'TotalCoolingConsumed',
        'TotalDryConsumed',
        'TotalFanConsumed',
        'TotalHeatingConsumed',
        'TotalOtherConsumed',
    ],
    'meter_power.daily_auto': ['TotalAutoConsumed'],
    'meter_power.daily_cooling': ['TotalCoolingConsumed'],
    'meter_power.daily_dry': ['TotalDryConsumed'],
    'meter_power.daily_fan': ['TotalFanConsumed'],
    'meter_power.daily_heating': ['TotalHeatingConsumed'],
    'meter_power.daily_other': ['TotalOtherConsumed'],
    'meter_power.dry': ['TotalDryConsumed'],
    'meter_power.fan': ['TotalFanConsumed'],
    'meter_power.heating': ['TotalHeatingConsumed'],
    'meter_power.other': ['TotalOtherConsumed'],
};
//# sourceMappingURL=ata.mjs.map