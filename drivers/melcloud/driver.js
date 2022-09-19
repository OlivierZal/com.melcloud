const Homey = require('homey');
const { MelCloudDriverMixin } = require('../../melcloudmixin');

class MelCloudDriverAC extends MelCloudDriverMixin {
  onInit() {
    // Trigger flowcards
    this.ThermostatModeTrigger = new Homey.FlowCardTriggerDevice('Full_Thermostat_Trigger').register();
    this.ThermostatModeTrigger.registerRunListener((args) => {
      const conditionMet = args.mode_capability_action === args.device.getCapabilityValue('mode_capability');
      return Promise.resolve(conditionMet);
    });

    this.FanSpeedTrigger = new Homey.FlowCardTriggerDevice('Fan_Speed_Trigger').register();
    this.FanSpeedTrigger.registerRunListener((args) => {
      const conditionMet = args.fan_speed_action === args.device.getCapabilityValue('fan_power');
      return Promise.resolve(conditionMet);
    });

    this.VerticalSwingTrigger = new Homey.FlowCardTriggerDevice('Vertical_Swing_Trigger').register();
    this.VerticalSwingTrigger.registerRunListener((args) => {
      const conditionMet = args.vertical_swing_action === args.device.getCapabilityValue('vertical');
      return Promise.resolve(conditionMet);
    });

    this.HorizontalSwingTrigger = new Homey.FlowCardTriggerDevice('Horizontal_Swing_Trigger').register();
    this.HorizontalSwingTrigger.registerRunListener((args) => {
      const conditionMet = args.horizontal_swing_action === args.device.getCapabilityValue('horizontal');
      return Promise.resolve(conditionMet);
    });

    // Condition flowcards
    this.ThermostatModeCondition = new Homey.FlowCardCondition('Full_Thermostat_Condition').register();
    this.ThermostatModeCondition.registerRunListener((args) => {
      const conditionMet = args.mode_capability_condition === args.device.getCapabilityValue('mode_capability');
      return Promise.resolve(conditionMet);
    });

    this.FanSpeedCondition = new Homey.FlowCardCondition('Fan_Speed_Condition').register();
    this.FanSpeedCondition.registerRunListener((args) => {
      const conditionMet = args.fan_speed_condition === args.device.getCapabilityValue('fan_power');
      return Promise.resolve(conditionMet);
    });

    this.VerticalSwingCondition = new Homey.FlowCardCondition('Vertical_Swing_Condition').register();
    this.VerticalSwingCondition.registerRunListener((args) => {
      const conditionMet = args.vertical_swing_condition === args.device.getCapabilityValue('vertical');
      return Promise.resolve(conditionMet);
    });

    this.HorizontalSwingCondition = new Homey.FlowCardCondition('Horizontal_Swing_Condition').register();
    this.HorizontalSwingCondition.registerRunListener((args) => {
      const conditionMet = args.hotizontal_swing_condition === args.device.getCapabilityValue('horizontal');
      return Promise.resolve(conditionMet);
    });

    // Action flowcards
    this.ThermostatModeAction = new Homey.FlowCardAction('Full_Thermostat_Action').register();
    this.ThermostatModeAction.registerRunListener((args) => {
      args.device.onCapabilitySetMode(args.mode_capability_action);
      return Promise.resolve(args.mode_capability_action);
    });
    this.FanSpeedAction = new Homey.FlowCardAction('Fan_Speed_Action').register();
    this.FanSpeedAction.registerRunListener((args) => {
      args.device.onCapabilityFanSet(Number(args.fan_speed_action));
      return Promise.resolve(args.fan_speed_action);
    });
    this.VerticalAction = new Homey.FlowCardAction('Vertical_Swing_Action').register();
    this.VerticalAction.registerRunListener((args) => {
      args.device.onCapabilityVerticalSet(args.vertical_swing_action);
      return Promise.resolve(args.vertical_swing_action);
    });
    this.HorizontalAction = new Homey.FlowCardAction('Horizontal_Swing_Action').register();
    this.HorizontalAction.registerRunListener((args) => {
      args.device.onCapabilityHorizontalSet(args.horizontal_swing_action);
      return Promise.resolve(args.horizontal_swing_action);
    });
  }

  triggerThermostatModeChange(device) {
    this.ThermostatModeTrigger.trigger(device);
    return this;
  }

  triggerVerticalSwingChange(device) {
    this.VerticalSwingTrigger.trigger(device);
    return this;
  }

  triggerHorizontalSwingChange(device) {
    this.HorizontalSwingTrigger.trigger(device);
    return this;
  }

  triggerFanSpeedChange(device) {
    this.FanSpeedTrigger.trigger(device);
    return this;
  }
}

module.exports = MelCloudDriverAC;
