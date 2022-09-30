const MelCloudDriverMixin = require('../melcloudmixin');

class MelCloudDriverAC extends MelCloudDriverMixin {
  async onInit() {
    this.DeviceType = 0;

    // Device trigger flowcards
    this.ThermostatModeTrigger = this.homey.flow
      .getDeviceTriggerCard('Full_Thermostat_Trigger')
      .registerRunListener((args) => args.mode_capability_action === args.device.getCapabilityValue('mode_capability'));

    this.FanSpeedTrigger = this.homey.flow
      .getDeviceTriggerCard('Fan_Speed_Trigger')
      .registerRunListener((args) => args.fan_speed_action === args.device.getCapabilityValue('fan_power'));

    this.VerticalSwingTrigger = this.homey.flow
      .getDeviceTriggerCard('Vertical_Swing_Trigger')
      .registerRunListener((args) => args.vertical_swing_action === args.device.getCapabilityValue('vertical'));

    this.HorizontalSwingTrigger = this.homey.flow
      .getDeviceTriggerCard('Horizontal_Swing_Trigger')
      .registerRunListener((args) => args.horizontal_swing_action === args.device.getCapabilityValue('horizontal'));

    // Condition flowcards
    this.ThermostatModeCondition = this.homey.flow
      .getConditionCard('Full_Thermostat_Condition')
      .registerRunListener((args) => args.mode_capability_condition === args.device.getCapabilityValue('mode_capability'));

    this.FanSpeedCondition = this.homey.flow
      .getConditionCard('Fan_Speed_Condition')
      .registerRunListener((args) => args.fan_speed_condition === args.device.getCapabilityValue('fan_power'));

    this.VerticalSwingCondition = this.homey.flow
      .getConditionCard('Vertical_Swing_Condition')
      .registerRunListener((args) => args.vertical_swing_condition === args.device.getCapabilityValue('vertical'));

    this.HorizontalSwingCondition = this.homey.flow
      .getConditionCard('Horizontal_Swing_Condition')
      .registerRunListener((args) => args.hotizontal_swing_condition === args.device.getCapabilityValue('horizontal'));

    // Action flowcards
    this.ThermostatModeAction = this.homey.flow
      .getActionCard('Full_Thermostat_Action')
      .registerRunListener((args) => {
        args.device.onCapabilitySetMode(args.mode_capability_action);
      });
    this.FanSpeedAction = this.homey.flow
      .getActionCard('Fan_Speed_Action')
      .registerRunListener((args) => {
        args.device.onCapabilityFanSet(Number(args.fan_speed_action));
      });
    this.VerticalAction = this.homey.flow
      .getActionCard('Vertical_Swing_Action')
      .registerRunListener((args) => {
        args.device.onCapabilityVerticalSet(args.vertical_swing_action);
      });
    this.HorizontalAction = this.homey.flow
      .getActionCard('Horizontal_Swing_Action')
      .registerRunListener((args) => {
        args.device.onCapabilityHorizontalSet(args.horizontal_swing_action);
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
