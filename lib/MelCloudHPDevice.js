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
        this.registerCapabilityListener('forcedhotwater', this.onCapabilityForcedHotWater.bind(this));
        this.getdevicedata(this);
    }

    getdevicedata(data, callback){
        let ContextKey = Homey.ManagerSettings.get('ContextKey')
        let devicee = this.getData() 
        let device = this
        let askdevice = {
            uri: "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/Get?id="+devicee.id+"&buildingID="+devicee.buildingid,
            json: true,
            headers: {'X-MitsContextKey': ContextKey},
        }
        http.get(askdevice).then(function (result) {
            if (result.response.statusCode !== 200) return (new Error('no_devices'))
            if (result.data) {
                if (result.data.SetTemperature < "10"){
                    device.setCapabilityValue("target_temperature", 10)
                }else if (result.data.SetTemperature > "30") {
                    device.setCapabilityValue("target_temperature", 30 )
                } else {
                    device.setCapabilityValue("target_temperature", result.data.SetHeatFlowTemperatureZone1)
                }
                device.setCapabilityValue("measure_temperature", result.data.RoomTemperatureZone1)
                device.setCapabilityValue("onoff", result.data.Power)
                device.setCapabilityValue("forcedhotwater", result.data.forcedHotWaterMode)
                device.setCapabilityValue("watertank_temperature", result.data.SetTankWaterTemperature)

                console.log("************ UPDATE DEVICE FROM CLOUD - " + devicee.name + "******************")
                console.log("equip: ",devicee.name)
                console.log("onoff: ",device.getCapabilityValue('onoff'))
                console.log("target_temperature: ",device.getCapabilityValue('target_temperature'))
                console.log("measure_temperature: ",device.getCapabilityValue('measure_temperature'))
                console.log("forcedhotwater: ",device.getCapabilityValue('forcedhotwater'))
                console.log("watertank_temperature: ",device.getCapabilityValue('watertank_temperature'))

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
            
            console.log("************ SET DEVICE TO CLOUD - " + devicee.name + "******************")
            console.log("equip: ",devicee.name)
            console.log("onoff: ",this.getCapabilityValue('onoff'))
            console.log("target_temperature: ",this.getCapabilityValue('target_temperature'))
            console.log("forcedhotwater: ",this.getCapabilityValue('forcedhotwater'))
            console.log("watertank_temperature: ",this.getCapabilityValue('watertank_temperature'))

            let askdevice = {
                uri: "https://app.melcloud.com/Mitsubishi.Wifi.Client/Device/SetAta",
                json: true,
                headers: {'X-MitsContextKey': ContextKey},
                json:{
                    'DeviceID': devicee.id,
                    'EffectiveFlags' : 281483566710825,
                    'HasPendingCommand' : 'true',
                    'Power': this.getCapabilityValue('onoff'),
                    'SetHeatFlowTemperatureZone1': this.getCapabilityValue('target_temperature'),
                    'forcedHotWaterMode': this.getCapabilityValue('forcedhotwater'),
                    'DeviceType' : 1,
                    'SetTankWaterTemperature': this.getCapabilityValue('watertank_temperature'),
                }
            }
            let next 
            await http.post(askdevice).then(function (result) {
                if (result.response.statusCode !== 200) return (new Error('no_devices'))
                if (result.data) {
                    console.log(result.data)
                    next = result.data.NextCommunication
                    return "HOLA"
                }
            })
            this._syncTimeout = setTimeout(this.getdevicedata.bind(this), (1*60*1000));
            console.log("Update in ... 1 min - FROM SET")
        } catch (error){
            console.log(error);
        }
    };

    async onCapabilityOnOff (value, opts){
        try{
            console.log("ON OFF")
            await this.setCapabilityValue('onoff', value)
            this.updateCapabilityValues()
        }catch (err) {
            throw new Error(err);
        }
    } 

    async onCapabilityForcedHotWater (value, opts){
        try{
            console.log("FORCED WATER")
            let forced = Boolean
            if (value === true){
                forced = true
            } else if (value == "true"){
                forced = true 
            } else {
                forced = false
            }
            await this.setCapabilityValue('forcedhotwater', forced)
            let driver = this.getDriver()
            driver.triggerForcedHotWaterChange (this)
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

    
}

module.exports = MelCloudDevice;
