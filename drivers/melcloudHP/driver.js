const MelCloudDriverMixin = require('../melcloudmixin');

class MelCloudDriverHP extends MelCloudDriverMixin {
  async onInit() {
    this.DeviceType = 1;

    // Device trigger flowcards
    this.ForcedWaterTrigger = this.homey.flow
      .getDeviceTriggerCard('Forced_Water_Trigger')
      .registerRunListener((args) => args.forced_hot_water_trigger === args.device.getCapabilityValue('forcedhotwater'));

    this.ModeTrigger = this.homey.flow
      .getDeviceTriggerCard('Pump1_Thermostat_Trigger')
      .registerRunListener((args) => args.mode_hpz1_action === args.device.getCapabilityValue('mode_heatpump1'));

    this.Hot_Water_Trigger = this.homey.flow
      .getDeviceTriggerCard('Hot_Water_Trigger')
      .registerRunListener(() => true);

    this.Cold_Water_Trigger = this.homey.flow
      .getDeviceTriggerCard('Cold_Water_Trigger')
      .registerRunListener(() => true);

    this.OperationModeTrigger = this.homey.flow
      .getDeviceTriggerCard('Operation_Mode_Trigger')
      .registerRunListener(() => true);

    // Condition flowcards
    this.ForcedHotWaterCondition = this.homey.flow
      .getConditionCard('Forced_Hot_Water_Condition')
      .registerRunListener((args) => args.forced_hot_water_condition === args.device.getCapabilityValue('forcedhotwater'));

    this.ModeCondition = this.homey.flow
      .getConditionCard('Pump1_Thermostat_Condition')
      .registerRunListener((args) => args.mode_hpz1_condition === args.device.getCapabilityValue('mode_heatpump1'));

    this.Hot_Water_Condition = this.homey.flow
      .getConditionCard('Hot_Water_Condition')
      .registerRunListener((args) => args.hot_water_value <= args.device.getCapabilityValue('hot_temperature'));

    this.Cold_Water_Condition = this.homey.flow
      .getConditionCard('Cold_Water_Condition')
      .registerRunListener((args) => args.cold_water_value >= args.device.getCapabilityValue('cold_temperature'));

    this.OperationModeCondition = this.homey.flow
      .getConditionCard('Operation_Mode_Condition')
      .registerRunListener((args) => {
        const settings = args.device.getSettings();
        return args.operation_mode_condition === settings.operationmode;
      });

    this.alarm_BoosterHeater1Condition = this.homey.flow
      .getConditionCard('alarm_BoosterHeater1_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('alarm_boosterheater1'));
    this.alarm_BoosterHeater2Condition = this.homey.flow
      .getConditionCard('alarm_BoosterHeater2_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('alarm_boosterheater2'));
    this.alarm_BoosterHeater2PlusCondition = this.homey.flow
      .getConditionCard('alarm_BoosterHeater2Plus_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('alarm_boosterheater2plus'));
    this.alarm_ImmersionHeaterCondition = this.homey.flow
      .getConditionCard('alarm_ImmersionHeater_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('alarm_immersionheater'));
    this.alarm_DefrostModeCondition = this.homey.flow
      .getConditionCard('alarm_DefrostMode_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('alarm_DefrostMode_Condition'));

    // Action flowcards
    this.ModeAction = this.homey.flow
      .getActionCard('Pump1_Thermostat_Action')
      .registerRunListener((args) => {
        const value = args.mode_hpom_action;
        args.device.onCapabilityMode(value);
        return value;
      });

    this.OperationModeAction = this.homey.flow
      .getActionCard('Operation_Mode_Action')
      .registerRunListener((args) => {
        const value = args.operation_mode_action;
        args.device.onCapabilityOperationMode(value);
        return value;
      });

    this.Heat_Water_Action = this.homey.flow
      .getActionCard('Heat_Water_Action')
      .registerRunListener((args) => {
        const value = args.heat_water_value;
        args.device.setSettings({ heattemperature: value });
        args.device.setCapabilityValue('heat_temperature', value).catch(this.error);
        setTimeout(() => args.device.updateCapabilityValues(), 1000);
        return value;
      });

    this.Cool_Water_Action = this.homey.flow
      .getActionCard('Cool_Water_Action')
      .registerRunListener((args) => {
        const value = args.cool_water_value;
        args.device.setSettings({ cooltemperature: value });
        args.device.setCapabilityValue('cold_temperature', value).catch(this.error);
        setTimeout(() => args.device.updateCapabilityValues(), 1000);
        return value;
      });

    this.Water_Tank_Temp_Action = this.homey.flow
      .getActionCard('Water_Tank_Temp_Action')
      .registerRunListener((args) => {
        const value = args.tank_water_value;
        args.device.setSettings({ tanktemperature: value });
        args.device.setCapabilityValue('watertank_temperature', value).catch(this.error);
        setTimeout(() => args.device.updateCapabilityValues(), 1000);
        return value;
      });

    this.ForcedHotWaterAction = this.homey.flow
      .getActionCard('Forced_Hot_Water_Action')
      .registerRunListener((args) => {
        const value = args.forced_hot_water_action;
        args.device.onCapabilityForcedHotWater(value);
        return value;
      });

    this.EcoHotWaterAction = this.homey.flow
      .getActionCard('Eco_Hot_Water_Action')
      .registerRunListener((args) => {
        const value = args.eco_hot_water_action;
        args.device.onCapabilityEcoHotWater(value);
        return value;
      });
  }

  triggerForcedHotWaterChange(device) {
    this.ForcedWaterTrigger.trigger(device);
    return this;
  }

  triggerModeChange(device) {
    this.ModeTrigger.trigger(device);
    return this;
  }

  triggerColdWaterChange(device) {
    this.Cold_Water_Trigger.trigger(device);
    return this;
  }

  triggerHotWaterChange(device) {
    this.Hot_Water_Trigger.trigger(device);
    return this;
  }

  triggerOperationModeChange(device) {
    this.OperationModeTrigger.trigger(device);
    return this;
  }
}

module.exports = MelCloudDriverHP;
