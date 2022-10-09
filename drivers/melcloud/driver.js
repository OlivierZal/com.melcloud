const MELCloudAtaDriverMixin = require('../melclouddrivermixin');

class MELCloudAtaDriver extends MELCloudAtaDriverMixin {
  async onInit() {
    this.deviceType = 0;

    // Device trigger flowcards
    this.operationModeTrigger = this.homey.flow
      .getDeviceTriggerCard('Full_Thermostat_Trigger')
      .registerRunListener((args) => {
        if (args.mode_capability_action === 'any') {
          return true;
        }
        return args.mode_capability_action === args.device.getCapabilityValue('operation_mode');
      });

    this.fanSpeedTrigger = this.homey.flow
      .getDeviceTriggerCard('Fan_Speed_Trigger')
      .registerRunListener((args) => {
        if (args.fan_speed_action === 'any') {
          return true;
        }
        return Number(args.fan_speed_action) === args.device.getCapabilityValue('fan_power');
      });

    this.verticalVaneDirectionTrigger = this.homey.flow
      .getDeviceTriggerCard('Vertical_Swing_Trigger')
      .registerRunListener((args) => {
        if (args.vertical_swing_action === 'any') {
          return true;
        }
        return args.vertical_swing_action === args.device.getCapabilityValue('vertical');
      });

    this.horizontalVaneDirectionTrigger = this.homey.flow
      .getDeviceTriggerCard('Horizontal_Swing_Trigger')
      .registerRunListener((args) => {
        if (args.horizontal_swing_action === 'any') {
          return true;
        }
        return args.horizontal_swing_action === args.device.getCapabilityValue('horizontal');
      });

    // Condition flowcards
    this.homey.flow
      .getConditionCard('Full_Thermostat_Condition')
      .registerRunListener((args) => args.mode_capability_condition === args.device.getCapabilityValue('operation_mode'));

    this.homey.flow
      .getConditionCard('Fan_Speed_Condition')
      .registerRunListener((args) => Number(args.fan_speed_condition) === args.device.getCapabilityValue('fan_power'));

    this.homey.flow
      .getConditionCard('Vertical_Swing_Condition')
      .registerRunListener((args) => args.vertical_swing_condition === args.device.getCapabilityValue('vertical'));

    this.homey.flow
      .getConditionCard('Horizontal_Swing_Condition')
      .registerRunListener((args) => args.hotizontal_swing_condition === args.device.getCapabilityValue('horizontal'));

    // Action flowcards
    this.homey.flow
      .getActionCard('Full_Thermostat_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationMode(args.mode_capability_action);
      });

    this.homey.flow
      .getActionCard('Fan_Speed_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityFanSpeed(Number(args.fan_speed_action));
      });

    this.homey.flow
      .getActionCard('Vertical_Swing_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityVerticalVaneDirection(args.vertical_swing_action);
      });

    this.homey.flow
      .getActionCard('Horizontal_Swing_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityHorizontalVaneDirection(args.horizontal_swing_action);
      });
  }

  // Triggers
  triggerOperationMode(device) {
    this.operationModeTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode\` has changed to \`${device.getCapabilityValue('operation_mode')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode\` has not been triggered (${error})`));
  }

  triggerFanSpeed(device) {
    this.fanSpeedTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`fan_power\` has changed to \`${device.getCapabilityValue('fan_power')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`fan_power\` has not been triggered (${error})`));
  }

  triggerVerticalVaneDirection(device) {
    this.verticalVaneDirectionTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`vertical\` has changed to \`${device.getCapabilityValue('vertical')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`vertical\` has not been triggered (${error})`));
  }

  triggerHorizontalVaneDirection(device) {
    this.horizontalVaneDirectionTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`horizontal\` has changed to \`${device.getCapabilityValue('horizontal')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`horizontal\` has not been triggered (${error})`));
  }
}

module.exports = MELCloudAtaDriver;
