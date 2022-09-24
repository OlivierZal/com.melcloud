const Homey = require('homey');
const { MelCloudDriverMixin } = require('../melcloudmixin');

class MelCloudDriverHP extends MelCloudDriverMixin {
  onInit() {
    // Trigger flowcards
    this.ForcedWaterTrigger = new Homey.FlowCardTriggerDevice('Forced_Water_Trigger').register();
    this.ForcedWaterTrigger.registerRunListener((args) => {
      const forced = args.forced_hot_water_trigger;
      const conditionMet = forced === args.device.getCapabilityValue('forcedhotwater');
      return Promise.resolve(conditionMet);
    });

    this.ModeTrigger = new Homey.FlowCardTriggerDevice('Pump1_Thermostat_Trigger').register();
    this.ModeTrigger.registerRunListener((args) => {
      const conditionMet = args.mode_hpz1_action === args.device.getCapabilityValue('mode_heatpump1');
      return Promise.resolve(conditionMet);
    });

    this.Hot_Water_Trigger = new Homey.FlowCardTriggerDevice('Hot_Water_Trigger').register();
    this.Hot_Water_Trigger.registerRunListener(() => {
      const conditionMet = true;
      return Promise.resolve(conditionMet);
    });

    this.Cold_Water_Trigger = new Homey.FlowCardTriggerDevice('Cold_Water_Trigger').register();
    this.Cold_Water_Trigger.registerRunListener(() => {
      const conditionMet = true;
      return Promise.resolve(conditionMet);
    });

    this.OperationModeTrigger = new Homey.FlowCardTriggerDevice('Operation_Mode_Trigger').register();
    this.OperationModeTrigger.registerRunListener(() => {
      const conditionMet = true;
      return Promise.resolve(conditionMet);
    });

    // Condition flowcards
    this.ForcedHotWaterCondition = new Homey.FlowCardCondition('Forced_Hot_Water_Condition').register();
    this.ForcedHotWaterCondition.registerRunListener((args) => {
      const forced = args.forced_hot_water_condition;
      const conditionMet = forced === args.device.getCapabilityValue('forcedhotwater');
      return Promise.resolve(conditionMet);
    });

    this.ModeCondition = new Homey.FlowCardCondition('Pump1_Thermostat_Condition').register();
    this.ModeCondition.registerRunListener((args) => {
      const conditionMet = args.mode_hpz1_condition === args.device.getCapabilityValue('mode_heatpump1');
      return Promise.resolve(conditionMet);
    });

    this.Hot_Water_Condition = new Homey.FlowCardCondition('Hot_Water_Condition').register();
    this.Hot_Water_Condition.registerRunListener((args) => {
      const conditionMet = args.hot_water_value <= args.device.getCapabilityValue('hot_temperature');
      return Promise.resolve(conditionMet);
    });

    this.Cold_Water_Condition = new Homey.FlowCardCondition('Cold_Water_Condition').register();
    this.Cold_Water_Condition.registerRunListener((args) => {
      const conditionMet = args.cold_water_value >= args.device.getCapabilityValue('cold_temperature');
      return Promise.resolve(conditionMet);
    });

    this.OperationModeCondition = new Homey.FlowCardCondition('Operation_Mode_Condition').register();
    this.OperationModeCondition.registerRunListener((args) => {
      const settings = args.device.getSettings();
      const conditionMet = args.operation_mode_condition === settings.operationmode;
      return Promise.resolve(conditionMet);
    });

    this.alarm_BoosterHeater1Condition = new Homey.FlowCardCondition('alarm_BoosterHeater1_Condition').register();
    this.alarm_BoosterHeater1Condition.registerRunListener((args) => {
      const conditionMet = args.device.getCapabilityValue('alarm_boosterheater1');
      return Promise.resolve(conditionMet);
    });
    this.alarm_BoosterHeater2Condition = new Homey.FlowCardCondition('alarm_BoosterHeater2_Condition').register();
    this.alarm_BoosterHeater2Condition.registerRunListener((args) => {
      const conditionMet = args.device.getCapabilityValue('alarm_boosterheater2');
      return Promise.resolve(conditionMet);
    });
    this.alarm_BoosterHeater2PlusCondition = new Homey.FlowCardCondition('alarm_BoosterHeater2Plus_Condition').register();
    this.alarm_BoosterHeater2PlusCondition.registerRunListener((args) => {
      const conditionMet = args.device.getCapabilityValue('alarm_boosterheater2plus');
      return Promise.resolve(conditionMet);
    });
    this.alarm_ImmersionHeaterCondition = new Homey.FlowCardCondition('alarm_ImmersionHeater_Condition').register();
    this.alarm_ImmersionHeaterCondition.registerRunListener((args) => {
      const conditionMet = args.device.getCapabilityValue('alarm_immersionheater');
      return Promise.resolve(conditionMet);
    });
    this.alarm_DefrostModeCondition = new Homey.FlowCardCondition('alarm_DefrostMode_Condition').register();
    this.alarm_DefrostModeCondition.registerRunListener((args) => {
      const conditionMet = args.device.getCapabilityValue('alarm_DefrostMode_Condition');
      return Promise.resolve(conditionMet);
    });

    // Action flowcards
    this.ModeAction = new Homey.FlowCardAction('Pump1_Thermostat_Action').register();
    this.ModeAction.registerRunListener((args) => {
      const value = args.mode_hpz1_action;
      args.device.onCapabilityMode(value);
      return Promise.resolve(value);
    });

    this.OperationModeAction = new Homey.FlowCardAction('Operation_Mode_Action').register();
    this.OperationModeAction.registerRunListener((args) => {
      const value = args.operation_mode_action;
      args.device.onCapabilityOperationMode(value);
      return Promise.resolve(value);
    });

    this.Heat_Water_Action = new Homey.FlowCardAction('Heat_Water_Action').register();
    this.Heat_Water_Action.registerRunListener((args) => {
      const value = args.heat_water_value;
      args.device.setSettings({ heattemperature: value });
      args.device.setCapabilityValue('heat_temperature', value);
      setTimeout(() => args.device.updateCapabilityValues(), 1000);
      return Promise.resolve(value);
    });

    this.Cool_Water_Action = new Homey.FlowCardAction('Cool_Water_Action').register();
    this.Cool_Water_Action.registerRunListener((args) => {
      const value = args.cool_water_value;
      args.device.setSettings({ cooltemperature: value });
      args.device.setCapabilityValue('cold_temperature', value);
      setTimeout(() => args.device.updateCapabilityValues(), 1000);
      return Promise.resolve(value);
    });

    this.Water_Tank_Temp_Action = new Homey.FlowCardAction('Water_Tank_Temp_Action').register();
    this.Water_Tank_Temp_Action.registerRunListener((args) => {
      const value = args.tank_water_value;
      args.device.setSettings({ tanktemperature: value });
      args.device.setCapabilityValue('watertank_temperature', value);
      setTimeout(() => args.device.updateCapabilityValues(), 1000);
      return Promise.resolve(value);
    });

    this.ForcedHotWaterAction = new Homey.FlowCardAction('Forced_Hot_Water_Action').register();
    this.ForcedHotWaterAction.registerRunListener((args) => {
      const value = args.forced_hot_water_action;
      args.device.onCapabilityForcedHotWater(value);
      return Promise.resolve(value);
    });

    this.EcoHotWaterAction = new Homey.FlowCardAction('Eco_Hot_Water_Action').register();
    this.EcoHotWaterAction.registerRunListener((args) => {
      const value = args.eco_hot_water_action;
      args.device.onCapabilityEcoHotWater(value);
      return Promise.resolve(value);
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
