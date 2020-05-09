"use strict";

const Homey = require('homey');
const http = require('http.min');

class MelCloudDriver extends Homey.Driver {

    onInit() {

        // --------- TRIGGER FLOWCARDS --------------------------

		this._ThermostatModeTrigger = new Homey.FlowCardTriggerDevice('Full_Thermostat_Trigger').register();
		this._ThermostatModeTrigger.registerRunListener((args, state) => {
            let conditionMet = args.mode_capability_action == args.device.getCapabilityValue('thermostat_mode');
            return Promise.resolve(conditionMet);
        })

		this._FanSpeedTrigger = new Homey.FlowCardTriggerDevice('Fan_Speed_Trigger').register();
		this._FanSpeedTrigger.registerRunListener((args) => {
            let conditionMet = args.fan_speed_action == args.device.getCapabilityValue('fan_power');
            return Promise.resolve(conditionMet);
        })

        this._VerticalSwingTrigger = new Homey.FlowCardTriggerDevice('Vertical_Swing_Trigger').register();
		this._VerticalSwingTrigger.registerRunListener((args) => {
            let conditionMet = args.vertical_swing_action == args.device.getCapabilityValue('vertical');
            return Promise.resolve(conditionMet);
        })

        this._HorizontalSwingTrigger = new Homey.FlowCardTriggerDevice('Horizontal_Swing_Trigger').register();
		this._HorizontalSwingTrigger.registerRunListener((args) => {
            let conditionMet = args.hotizontal_swing_action == args.device.getCapabilityValue('horizontal');
            return Promise.resolve(conditionMet);
        })

        // --------- CONDITION FLOWCARDS --------------------------
          
		this._ThermostatModeCondition = new Homey.FlowCardCondition('Full_Thermostat_Condition').register();
		this._ThermostatModeCondition.registerRunListener((args, state) => {
            console.log()
            let conditionMet = args.mode_capability_condition == args.device.getCapabilityValue('thermostat_mode');
            return Promise.resolve(conditionMet);
		});

        this._FanSpeedCondition = new Homey.FlowCardCondition('Fan_Speed_Condition').register();
		this._FanSpeedCondition.registerRunListener((args, state) => {
            let conditionMet = args.fan_speed_condition == args.device.getCapabilityValue('fan_power');
            return Promise.resolve(conditionMet);
		});

        this._VerticalSwingCondition = new Homey.FlowCardCondition('Vertical_Swing_Condition').register();
		this._VerticalSwingCondition.registerRunListener((args) => {
            let conditionMet = args.vertical_swing_condition == args.device.getCapabilityValue('vertical');
            return Promise.resolve(conditionMet);
        })

        this._HorizontalSwingCondition = new Homey.FlowCardCondition('Horizontal_Swing_Condition').register();
		this._HorizontalSwingCondition.registerRunListener((args) => {
            let conditionMet = args.hotizontal_swing_condition == args.device.getCapabilityValue('horizontal');
            return Promise.resolve(conditionMet);
        })


        // --------- ACTION FLWOCARDS --------------------------
        this._ThermostatModeAction = new Homey.FlowCardAction('Full_Thermostat_Action').register();
		this._ThermostatModeAction.registerRunListener((args, state) => {          
            args.device.onCapabilitySetMode (args.mode_capability_action)
			return Promise.resolve(args.mode_capability_action) 
		});         
        this._FanSpeedAction = new Homey.FlowCardAction('Fan_Speed_Action').register();
		this._FanSpeedAction.registerRunListener((args, state) => {          
            let fan_action = Number(args.fan_speed_action)
            args.device.onCapabilityFanSet (fan_action)
			return Promise.resolve(args.fan_speed_action) 
        }); 
        this._VerticalAction = new Homey.FlowCardAction('Vertical_Swing_Action').register();
		this._VerticalAction.registerRunListener((args, state) => {    
            args.device.onCapabilityVerticalSet (args.vertical_swing_action)
            return Promise.resolve(args.vertical_swing_action) 
        }); 
        this._HorizontalAction = new Homey.FlowCardAction('Horizontal_Swing_Action').register();
		this._HorizontalAction.registerRunListener((args, state) => {
            args.device.onCapabilityHorizontalSet (args.horizontal_swing_action)
            return Promise.resolve(args.horizontal_swing_action) 
		});  

    }
    //--- triggering 

    triggerThermostatModeChange(device) {
        this._ThermostatModeTrigger.trigger(device);
        return this;
    } 
    triggerVerticalSwingChange(device) {
        this._VerticalSwingTrigger.trigger(device);
        return this;
    } 
    triggerHorizontalSwingChange(device) {
        this._HorizontalSwingTrigger.trigger(device);
        return this;
    } 
    triggerFanSpeedChange(device) {
        this._FanSpeedTrigger.trigger(device)
        return this;
    } 

    gettoken(username, password, callback){
        //Homey.ManagerSettings.set('username', username)
        //Homey.ManagerSettings.set('password', password)
        console.log("u:",username, " p:", password)
        let options={
            uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/Login/ClientLogin',
            json: true,
            json: {
                'AppVersion': '1.9.3.0',
                'CaptchaChallenge': '',
                'CaptchaResponse': '',
                'Email': username,
                'Language': '0',
                'Password': password,
                'Persist': 'true'
            }
        }
        http.post(options).then(function (result) {
            if (result.data.ErrorId !== null){
                return callback("false")
            } else if (result.data) {
                Homey.ManagerSettings.set('ContextKey', result.data.LoginData.ContextKey)
                return callback("endavant")
            }            
        })       
        this._syncTimeout = setTimeout(this.gettoken.bind(this), (24*3600*1000));
    }


    getdevices(data, callback){
        console.log("FINDEDEVICES!!!!")
        let ContextKey = Homey.ManagerSettings.get('ContextKey')
        let askdevices = {
            uri: 'https://app.melcloud.com/Mitsubishi.Wifi.Client/User/ListDevices',
            json: true,
            headers: {'X-MitsContextKey': ContextKey},
        }
        http.get(askdevices).then(function (result) {
            if (result.response.statusCode !== 200) return (new Error('no_devices'))
            if (result.data) {
                let a;
                let b;
                let f;
                let z;
                let devices = []
                let device = []
                for (a = 0; a < result.data.length; a++) {
                    for (b = 0; b < result.data[a].Structure.Devices.length; b++) {
                        device = result.data[a].Structure.Devices[b]
                        devices.push({
                            "name": device.DeviceName,
                            "data": {
                                "id": device.DeviceID,
                                "buildingid" : device.BuildingID,
                                "address": device.MacAddress,
                                "name": device.DeviceName,
                            },
                        });
                    }
                    for (f = 0; f < result.data[a].Structure.Floors.length; f++) {
                        for (b = 0; b < result.data[a].Structure.Floors[f].Devices.length; b++) {
                            device = result.data[a].Structure.Floors[f].Devices[b]
                            devices.push({
                                "name": device.DeviceName,
                                "data": {
                                    "id": device.DeviceID,
                                    "buildingid" : device.BuildingID,
                                    "address": device.MacAddress,
                                    "name": device.DeviceName,
                                },
                            });
                        }
                        for (f = 0; f < result.data[a].Structure.Floors.length; f++) {
                            for (z = 0; z < result.data[a].Structure.Floors[f].Areas.length; z++) {
                                for (b = 0; b < result.data[a].Structure.Floors[f].Areas[z].Devices.length; b++) {
                                    device = result.data[a].Structure.Floors[f].Areas[z].Devices[b]
                                    devices.push({
                                        "name": device.DeviceName,
                                        "data": {
                                            "id": device.DeviceID,
                                            "buildingid" : device.BuildingID,
                                            "address": device.MacAddress,
                                            "name": device.DeviceName,
                                        },
                                    });
                                }
                            }
                        }
                    }
                    for (z = 0; z < result.data[a].Structure.Areas.length; z++) {
                        for (b = 0; b < result.data[a].Structure.Areas[z].Devices.length; b++) {
                            device = result.data[a].Structure.Areas[z].Devices[b]
                            devices.push({
                                "name": device.DeviceName,
                                "data": {
                                    "id": device.DeviceID,
                                    "buildingid" : device.BuildingID,
                                    "address": device.MacAddress,
                                    "name": device.DeviceName,
                                },
                            });
                        }
                    }    
                }
                return callback(devices)
            }
          })
    }

    onPair (socket) {
        socket.on('login', (data, callback) => {
            if (data.username === '' || data.password === '') return callback(null, false)
            this.gettoken(data.username, data.password, function(resposta){
                console.log("RESP: ", resposta)
                if(resposta == "endavant"){
                    callback(null, true)
                } else {
                    callback(null, false)
                }
            })

        })
    
        socket.on('list_devices', (data, callback) => {
            this.getdevices("devices", function(devices){
                callback(null, devices)} 
        )})
        
        socket.on('add_device', (device, callback) => {
          console.log('pairing', device)
        })
    }
}

module.exports = MelCloudDriver;