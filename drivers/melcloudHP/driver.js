const Homey = require('homey'); // eslint-disable-line import/no-unresolved

class MELCloudHPDriver extends Homey.Driver {
  async onInit() {
    this.deviceType = 1;

    // Device trigger flowcards
    this.operationModeTrigger = this.homey.flow
      .getDeviceTriggerCard('Operation_Mode_Trigger')
      .registerRunListener((args) => args.operation_mode_trigger === args.device.getCapabilityValue('operation_mode_state'));

    this.operationModeZoneTrigger = this.homey.flow
      .getDeviceTriggerCard('Pump1_Thermostat_Trigger')
      .registerRunListener((args) => args.mode_hpz1_action === args.device.getCapabilityValue('operation_mode_zone'));

    this.forcedHotWaterTrigger = this.homey.flow
      .getDeviceTriggerCard('Forced_Water_Trigger')
      .registerRunListener((args) => args.forced_hot_water_trigger === args.device.getCapabilityValue('forced_hot_water'));

    this.flowTemperatureTrigger = this.homey.flow
      .getDeviceTriggerCard('Hot_Water_Trigger')
      .registerRunListener(() => true);

    this.returnTemperatureTrigger = this.homey.flow
      .getDeviceTriggerCard('Cold_Water_Trigger')
      .registerRunListener(() => true);

    // Condition flowcards
    this.homey.flow
      .getConditionCard('Operation_Mode_Condition')
      .registerRunListener((args) => args.operation_mode_condition === args.device.getCapabilityValue('operation_mode_state'));

    this.homey.flow
      .getConditionCard('Pump1_Thermostat_Condition')
      .registerRunListener((args) => args.mode_hpz1_condition === args.device.getCapabilityValue('operation_mode_zone'));

    this.homey.flow
      .getConditionCard('Forced_Hot_Water_Condition')
      .registerRunListener((args) => args.forced_hot_water_condition === args.device.getCapabilityValue('forced_hot_water'));

    this.homey.flow
      .getConditionCard('Hot_Water_Condition')
      .registerRunListener((args) => args.hot_water_value <= args.device.getCapabilityValue('flow_temperature'));

    this.homey.flow
      .getConditionCard('Cold_Water_Condition')
      .registerRunListener((args) => args.cold_water_value >= args.device.getCapabilityValue('return_temperature'));

    this.homey.flow
      .getConditionCard('alarm_DefrostMode_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('defrost_mode'));

    this.homey.flow
      .getConditionCard('alarm_BoosterHeater1_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('booster_heater1'));

    this.homey.flow
      .getConditionCard('alarm_BoosterHeater2_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('booster_heater2'));

    this.homey.flow
      .getConditionCard('alarm_BoosterHeater2Plus_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('booster_heater2_plus'));

    this.homey.flow
      .getConditionCard('alarm_ImmersionHeater_Condition')
      .registerRunListener((args) => args.device.getCapabilityValue('immersion_heater'));

    // Action flowcards
    this.homey.flow
      .getActionCard('Pump1_Thermostat_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityOperationModeZone(args.mode_hpom_action);
      });

    this.homey.flow
      .getActionCard('Forced_Hot_Water_Action')
      .registerRunListener(async (args) => {
        await args.device.onCapabilityForcedHotWater(args.forced_hot_water_action);
      });

    this.homey.flow
      .getActionCard('Cool_Water_Action')
      .registerRunListener(async (args) => {
        await args.device.setSettings({ cool_flow_temperature: args.cool_water_value });
        await args.device.syncDeviceFromData();
      });

    this.homey.flow
      .getActionCard('Heat_Water_Action')
      .registerRunListener(async (args) => {
        await args.device.setSettings({ heat_flow_temperature: args.heat_water_value });
        await args.device.syncDeviceFromData();
      });

    this.homey.flow
      .getActionCard('Water_Tank_Temp_Action')
      .registerRunListener(async (args) => {
        await args.device.setSettings({ set_watertank_temperature: args.tank_water_value });
        await args.device.syncDeviceFromData();
      });
  }

  // Triggers
  triggerOperationMode(device) {
    this.operationModeTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_state\` has changed to \`${device.getCapabilityValue('operation_mode_state')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_state\` has not been triggered (${error})`));
  }

  triggerOperationModeZone(device) {
    this.operationModeZoneTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`operation_mode_zone\` has changed to \`${device.getCapabilityValue('operation_mode_zone')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`operation_mode_zone\` has not been triggered (${error})`));
  }

  triggerFlowTemperature(device) {
    this.flowTemperatureTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`flow_temperature\` has changed to \`${device.getCapabilityValue('flow_temperature')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`flow_temperature\` has not been triggered (${error})`));
  }

  triggerReturnTemperature(device) {
    this.returnTemperatureTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`return_temperature\` has changed to \`${device.getCapabilityValue('return_temperature')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`return_temperature\` has not been triggered (${error})`));
  }

  triggerForcedHotWater(device) {
    this.forcedHotWaterTrigger
      .trigger(device)
      .then(this.log(`\`${device.getName()}\`: \`forced_hot_water\` has changed to \`${device.getCapabilityValue('forced_hot_water')}\``))
      .catch((error) => this.error(`\`${device.getName()}\`: \`forced_hot_water\` has not been triggered (${error})`));
  }

  instanceLog(...message) {
    this.log(...message);
  }

  instanceError(...message) {
    this.error(...message);
  }
}

module.exports = MELCloudHPDriver;
