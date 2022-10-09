const MELCloudDriverMixin = require('../melclouddrivermixin');

class MELCloudAtwDriver extends MELCloudDriverMixin {
  async onInit() {
    this.deviceType = 1;

    // Device trigger flowcards
    this.operationModeTrigger = this.homey.flow
      .getDeviceTriggerCard('operation_mode_trigger')
      .registerRunListener((args) => {
        if (args.operation_mode === 'any') {
          return true;
        }
        return args.operation_mode === args.device.getCapabilityValue('operation_mode_state');
      });

    this.operationModeZone1Trigger = this.homey.flow
      .getDeviceTriggerCard('operation_mode_zone1_trigger')
      .registerRunListener((args) => {
        if (args.operation_mode_zone === 'any') {
          return true;
        }
        return args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone1');
      });

    this.operationModeZone1Trigger = this.homey.flow
      .getDeviceTriggerCard('operation_mode_zone2_trigger')
      .registerRunListener((args) => {
        if (args.operation_mode_zone === 'any') {
          return true;
        }
        return args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone2');
      });

    this.operationModeZone1TriggerWithCool = this.homey.flow
      .getDeviceTriggerCard('operation_mode_zone1_with_cool_trigger')
      .registerRunListener((args) => {
        if (args.operation_mode_zone === 'any') {
          return true;
        }
        return args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone1');
      });

    this.operationModeZone1TriggerWithCool = this.homey.flow
      .getDeviceTriggerCard('operation_mode_zone2_with_cool_trigger')
      .registerRunListener((args) => {
        if (args.operation_mode_zone === 'any') {
          return true;
        }
        return args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone2');
      });

    // Condition flowcards
    this.homey.flow
      .getConditionCard('operation_mode_condition')
      .registerRunListener((args) => args.operation_mode === args.device.getCapabilityValue('operation_mode_state'));

    this.homey.flow
      .getConditionCard('operation_mode_zone1_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone1'));

    this.homey.flow
      .getConditionCard('operation_mode_zone2_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone.zone2'));

    this.homey.flow
      .getConditionCard('operation_mode_zone1_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone1'));

    this.homey.flow
      .getConditionCard('operation_mode_zone2_with_cool_condition')
      .registerRunListener((args) => args.operation_mode_zone === args.device.getCapabilityValue('operation_mode_zone_with_cool.zone2'));

    // Action flowcards
    this.homey.flow
      .getActionCard('operation_mode_zone1_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone1(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone2_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone2(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone1_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone1WithCool(args.operation_mode_zone);
      });

    this.homey.flow
      .getActionCard('operation_mode_zone2_with_cool_action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone2WithCool(args.operation_mode_zone);
      });
  }

  // Triggers
  triggerOperationMode(device) {
    this.operationModeTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_state\` has changed to \`${device.getCapabilityValue('operation_mode_state')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_state\` has not been triggered (${error})`));
  }

  triggerOperationModeZone1(device) {
    this.operationModeZone1Trigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_zone.zone1\` has changed to \`${device.getCapabilityValue('operation_mode_zone.zone1')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_zone.zone1\` has not been triggered (${error})`));
  }

  triggerOperationModeZone2(device) {
    this.operationModeZone2Trigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_zone.zone2\` has changed to \`${device.getCapabilityValue('operation_mode_zone.zone2')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_zone.zone2\` has not been triggered (${error})`));
  }

  triggerOperationModeZone1WithCool(device) {
    this.operationModeZone1WithCoolTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_zone_with_cool.zone1\` has changed to \`${device.getCapabilityValue('operation_mode_zone_with_cool.zone1')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_zone_with_cool.zone1\` has not been triggered (${error})`));
  }

  triggerOperationModeZone2WithCool(device) {
    this.operationModeZone2WithCoolTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_zone_with_cool.zone2\` has changed to \`${device.getCapabilityValue('operation_mode_zone_with_cool.zone2')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_zone_with_cool.zone2\` has not been triggered (${error})`));
  }
}

module.exports = MELCloudAtwDriver;
