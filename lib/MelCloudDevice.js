'use strict';

const Homey = require('homey');
const http = require('http.min');

const { ManagerNotifications } = require('homey');

class MelCloudDevice extends Homey.Device {

    async onAdded(){
        try{
            console.log("adding new device")
            await this.onInit();    
        } catch (error) {
            console.log(error);
        }
    }

    onInit() {
        const capabilities = this.getCapabilities();
        this.registerCapabilityListener('onoff', this.onCapabilityOnOff.bind(this));
        this.registerCapabilityListener('target_temperature', this.onCapabilitySetTemperature.bind(this));
        this.registerCapabilityListener('mode_capability', this.onCapabilitySetMode.bind(this));
        this.registerCapabilityListener('thermostat_mode', this.onCapabilitySetModether.bind(this));
        this.registerCapabilityListener('fan_power', this.onCapabilityFanSet.bind(this));
        this.registerCapabilityListener('vertical', this.onCapabilityVerticalSet.bind(this));
        this.registerCapabilityListener('horizontal', this.onCapabilityHorizontalSet.bind(this));
        this.getdevicedata(this);
    }

    getdevicedata(data, callback){
        let ContextKey = Homey.ManagerSettings.get('ContextKey')
        let devicee = this.getData() 
        let device = this
        let driver = this.getDriver()


        let askdevice = {
            uri: "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id="+devicee.id+"&buildingID="+devicee.buildingid,
            json: true,
            headers: {'X-MitsContextKey': ContextKey},
        }
        http.get(askdevice).then(function (result) {
            if (result.response.statusCode !== 200) return (new Error('no_devices'))
            if (result.data) {
                if (result.data.SetTemperature < "4"){
                    device.setCapabilityValue("target_temperature", 4)
                }else if (result.data.SetTemperature > "35") {
                    device.setCapabilityValue("target_temperature", 35 )
                } else {
                    device.setCapabilityValue("target_temperature", result.data.SetTemperature)
                }
                device.setCapabilityValue("measure_temperature", result.data.RoomTemperature)
                console.log("power: ",result.data.Power)
                device.setCapabilityValue("onoff", result.data.Power)
                let mode = device.ValuetoMode(result.data.OperationMode)
                //console.log("mode: ", mode)
                if( mode !== device.getCapabilityValue("mode_capability")) {driver.triggerThermostatModeChange(device)}
                device.setCapabilityValue("mode_capability", mode)
                device.SetModetherValue()
                if(result.data.SetFanSpeed !== device.getCapabilityValue("fan_power")) {driver.triggerFanSpeedChange(device)}
                device.setCapabilityValue("fan_power", result.data.SetFanSpeed)
                let vertical = device.ValuetoVertical(result.data.VaneVertical)
                if( vertical !== device.getCapabilityValue("vertical")) {driver.triggerVerticalSwingChange(device)}
                device.setCapabilityValue("vertical", vertical)
                let horizontal = device.ValuetoVertical(result.data.VaneHorizontal)
                if( horizontal !== device.getCapabilityValue("horizontal")) {driver.triggerHorizontalSwingChange(device)}
                device.setCapabilityValue("horizontal", horizontal)
                console.log("************ UPDATE DEVICE FROM CLOUD - " + devicee.name + "******************")
                console.log("equip: ",devicee.name)
                console.log("onoff: ",device.getCapabilityValue('onoff'))
                console.log("target_temperature: ",device.getCapabilityValue('target_temperature'))
                console.log("measure_temperature: ",device.getCapabilityValue('measure_temperature'))
                console.log("mode: ",device.getCapabilityValue('mode_capability'))
                console.log("modether ",device.getCapabilityValue('thermostat_mode'))
                console.log("fan_speed: ",device.getCapabilityValue('fan_power'))
                console.log("vertical: ",device.getCapabilityValue('vertical'))
                console.log("horizontal: ",device.getCapabilityValue('horizontal'))
                return 
            }
        })


        this._cancelTimeout = clearTimeout(this._syncTimeout)
        let updateInterval = this.getSettings().interval
        let interval = 1000 * 60 * updateInterval;
        this._syncTimeout = setTimeout(this.getdevicedata.bind(this), (interval));
        console.log("Next update for " + devicee.name + " in ... " + updateInterval + " min - from UPDATE")
    }

    async updateCapabilityValues(capability, value) {
        try {
            let ContextKey = Homey.ManagerSettings.get('ContextKey')
            let devicee = this.getData() 
            let mode = await this.ModetoValue(this.getCapabilityValue('mode_capability'))
            let vertical = await this.VerticaltoValue(this.getCapabilityValue('vertical'))
            let horizontal = await this.HorizontaltoValue(this.getCapabilityValue('horizontal'))
            console.log("************ SET DEVICE TO CLOUD - " + devicee.name + "******************")
            console.log("equip: ",devicee.name)
            console.log("onoff: ",this.getCapabilityValue('onoff'))
            console.log("target_temperature: ",this.getCapabilityValue('target_temperature'))
            console.log("mode: ",this.getCapabilityValue('mode_capability'))
            console.log("mode_code: ", mode)
            console.log("modether: ",this.getCapabilityValue('thermostat_mode'))
            console.log("fan_speed: ",this.getCapabilityValue('fan_power'))
            console.log("vertical: ",this.getCapabilityValue('vertical'))
            console.log("vertical_code: ", vertical)
            console.log("horizontal: ",this.getCapabilityValue('horizontal'))
            console.log("horizontal_code: ", horizontal)
            let askdevice = {
                uri: "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta",
                json: true,
                headers: {'X-MitsContextKey': ContextKey},
                json:{
                    'DeviceID': devicee.id,
                    'EffectiveFlags' : 0x1F,
                    'HasPendingCommand' : 'true',
                    'Power': this.getCapabilityValue('onoff'),
                    'SetTemperature': this.getCapabilityValue('target_temperature'),
                    'OperationMode': mode,
                    'SetFanSpeed': this.getCapabilityValue('fan_power'),
                    'VaneVertical': vertical,
                    'VaneHorizontal': horizontal,

                }
            }
            let next 
            await http.post(askdevice).then(function (result) {
                if (result.response.statusCode !== 200) return (new Error('no_devices'))
                if (result.data) {
                    next = result.data.NextCommunication
                    return "HOLA"
                }
            })
            this._syncTimeout = setTimeout(this.getdevicedata.bind(this), (2*60*1000));
            console.log("Update in ... 2 min - FROM SET")
        } catch (error){
            console.log(error);
        }
    };

    async onCapabilityOnOff (value, opts){
        try{
            console.log("ON OFF")
            await this.setCapabilityValue('onoff', value)
            if (value == true){
                await this.SetModetherValue()
            }else{
                //this.setCapabilityValue('mode_capability', "off")
                this.setCapabilityValue('thermostat_mode', "off")
            }
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilitySetTemperature (value, opts){
        try{
            console.log("SET TEMPERATURE")
            await this.setCapabilityValue('target_temperature', value)
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilitySetMode (value, opts){
        try{
            console.log("SET MODE")
            await this.setCapabilityValue('mode_capability', value)
            await this.SetModetherValue()
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilitySetModether (value, opts){
        try{
            console.log("SET MODETHERMOSTAT")
            await this.ValuetoModether(value) 
            let driver = this.getDriver()
            driver.triggerThermostatModeChange(this) 
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilityVerticalSet (value, opts){
        try{
            console.log("SET VERTICAL")
            await this.setCapabilityValue('vertical', value)
            let driver = this.getDriver()
            driver.triggerVerticalSwingChange(this) 
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilityHorizontalSet (value, opts){
        try{
            console.log("SET HORIZONTAL")
            await this.setCapabilityValue('horizontal', value)
            let driver = this.getDriver()
            driver.triggerHorizontalSwingChange(this) 
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilityFanSet (value){
        try{
            console.log("FAN SET ")
            await this.setCapabilityValue('fan_power', value)
            let driver = this.getDriver()
            driver.triggerFanSpeedChange(this)
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 


    ModetoValue (value){
        let mode
             if (value == "heat"){
                mode = 1
            }else if (value == "cool"){
                mode = 3
            }else if (value == "auto"){
                mode = 8
            }else if (value == "off"){
                mode = 0
            }else if (value == "fan"){
                mode = 7
            }else if (value == "dry"){
                mode = 2
            }
            return mode
    }
    ValuetoMode (mode){
        let value
            if (mode == 0){
                 value = "off"
            }else if (mode == 1){
                 value = "heat"
            }else if (mode == 2){
                value = "dry"
            }else if (mode == 3){
                value = "cool"
            }else if (mode == 7){
                value = "fan"
            }else if (mode == 8){
                value = "auto"
            }
            return value
    }

    async SetModetherValue (){
        try{
            let onoff = this.getCapabilityValue('onoff')
            let mode = this.getCapabilityValue ('mode_capability')
            let modether2 = this.getCapabilityValue ('thermostat_mode')
            let modether
                    if (mode == "cool"){
                        modether = "cool"
                        await this.setCapabilityValue('onoff', true)
                    }else if (mode == "cool" && onoff == false){
                        modether = "off"
                        await this.setCapabilityValue('onoff', false)
                    }else if (mode == "off"){
                        modether = "off"
                        await this.setCapabilityValue('onoff', false) 
                    }else if (mode == "heat" && onoff == true){
                        modether = "heat"
                        await this.setCapabilityValue('onoff', true)
                    }else if (mode == "heat" && onoff == false){
                        modether = "off"
                        await this.setCapabilityValue('onoff', false)
                    }else{
                        if (onoff = true){
                            modether = "auto"
                            if (mode !== "dry" && mode !=="fan") modether = "auto"
                            await this.setCapabilityValue('onoff', true)
                        } else {
                            modether = "off"
                            await this.setCapabilityValue('onoff', false)
                        }
                    } 
                await this.setCapabilityValue('thermostat_mode', modether) 
                await this.setCapabilityValue('mode_capability', mode)
                return modether
        }catch (err) {
            throw new Error(err);
            }
    }
    async ValuetoModether (value){
        try{
            await this.setCapabilityValue ('thermostat_mode', value)
            if (value == "off"){
                 await this.setCapabilityValue('onoff', false)
            }else if (value == "heat"){
                 await this.setCapabilityValue('onoff', true)
                 await this.setCapabilityValue('mode_capability', "heat")
            }else if (value == "cool"){
                await this.setCapabilityValue('onoff', true)
                await this.setCapabilityValue('mode_capability', "cool")
            }else if (value == "auto"){
                await this.setCapabilityValue('onoff', true)
            }
            return
        }catch (err) {
            throw new Error(err);
        }
    }

    VerticaltoValue (value){
        let vertical
             if (value == "auto"){
                vertical = 0
            }else if (value == "top"){
                vertical = 1
            }else if (value == "middletop"){
                vertical = 2
            }else if (value == "middle"){
                vertical = 3
            }else if (value == "middlebottom"){
                vertical = 4
            }else if (value == "bottom"){
                vertical = 5
            }else if (value == "swing"){
                vertical = 7
            }
            return vertical
    }
    ValuetoVertical (vertical){
        let value
            if (vertical == 0){
                 value = "auto"
            }else if (vertical == 1){
                 value = "top"
            }else if (vertical == 2){
                value = "middletop"
            }else if (vertical == 3){
                value = "middle"
            }else if (vertical == 4){
                value = "middlebottom"
            }else if (vertical == 5){
                value = "bottom"
            }else if (vertical == 7){
                value = "swing"
            }
            return value
    }

    HorizontaltoValue (value){
        let horizontal
             if (value == "auto"){
                horizontal = 0
            }else if (value == "left"){
                horizontal = 1
            }else if (value == "middle-left"){
                horizontal = 2
            }else if (value == "middle"){
                horizontal = 3
            }else if (value == "middleright"){
                horizontal = 4
            }else if (value == "right"){
                horizontal = 5
            }else if (value == "swing"){
                horizontal = 7
            }
            return horizontal
    }
    ValuetoHorizontal (horizontal){
        let value
            if (horizontal == 0){
                 value = "auto"
            }else if (horizontal == 1){
                 value = "left"
            }else if (horizontal == 2){
                value = "middleleft"
            }else if (horizontal == 3){
                value = "middle"
            }else if (horizontal == 4){
                value = "middleright"
            }else if (horizontal == 5){
                value = "right"
            }else if (horizontal == 7){
                value = "swing"
            }
            return value
    }
}

module.exports = MelCloudDevice;
