"use strict";

const Homey = require('homey');
const http = require('http.min');

class MelCloudDriver extends Homey.Driver {

    onInit() {

        // --------- TRIGGER FLOWCARDS --------------------------

		this._ForcedWaterTrigger = new Homey.FlowCardTriggerDevice('Forced_Water_Trigger').register();
		this._ForcedWaterTrigger.registerRunListener((args,state) => {
            let value = args.forced_hot_water_trigger
            let forced = Boolean
            if (value === true){
                forced = true
            } else if (value == "true"){
                forced = true 
            } else {
                forced = false
            }
            let conditionMet = forced == args.device.getCapabilityValue('forcedhotwater');
            return Promise.resolve(conditionMet);
        })

		        // --------- CONDITION FLOWCARDS --------------------------
          
		this._ForcedHotWaterCondition = new Homey.FlowCardCondition('Forced_Hot_Water_Condition').register();
		this._ForcedHotWaterCondition.registerRunListener((args, state) => {
            let forced = Boolean
            let value = args.forced_hot_water_condition
             if (value === true){
                forced = true
            } else if (value == "true"){
                forced = true 
            } else {
                forced = false
            }
            let conditionMet = forced ==args.device.getCapabilityValue('forcedhotwater');
            return Promise.resolve(conditionMet);
		});


        // --------- ACTION FLWOCARDS --------------------------
        this._ForcedHotWaterAction = new Homey.FlowCardAction('Forced_Hot_Water_Action').register();
		this._ForcedHotWaterAction.registerRunListener((args, state) => { 
            let forced = Boolean
            let value = args.forced_hot_water_action
             if (value === true){
                forced = true
            } else if (value == "true"){
                forced == true 
            } else {
                forced == false
            }        
            args.device.onCapabilityForcedHotWater (forced)
			return Promise.resolve(forced) 
		});         
        
    }
    //--- triggering 

    triggerForcedHotWaterChange(device) {
        this._ForcedWaterTrigger.trigger(device);
        return this;
    } 
   

    gettoken(username, password){
        Homey.ManagerSettings.set('username', username)
        Homey.ManagerSettings.set('password', password)
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
            if (result.data) {
                Homey.ManagerSettings.set('ContextKey', result.data.LoginData.ContextKey)
                return result.data.LoginData.ContextKey
            }
            if (result.response.statusCode !== 200) return (new Error('no_token'))
        })       
        this._syncTimeout = setTimeout(this.gettoken.bind(this), (24*3600*1000));
    }


    getdevices(data, callback){
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
            this.gettoken(data.username, data.password)
            setTimeout(function(){callback(null, true)},3000)
    
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