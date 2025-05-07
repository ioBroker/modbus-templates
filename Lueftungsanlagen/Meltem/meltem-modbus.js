////////////////////////////////////////////////
// Author: boriswerner (https://github.com/boriswerner/)
//
// Script Name: meltem
// Version: 0.1 
// Creation Date: 07.03.2025
//
// Description: This script is used to enhance and simplify controlling of meltem comfort ventilation units M-WRG / M-WRG-II
//              You need to connect the devices via modbus adapter to iobroker (https://github.com/ioBroker/ioBroker.modbus)
//              For more details see README in github https://github.com/ioBroker/modbus-templates/tree/main/Lueftungsanlagen/Meltem/
//
// Changelog: 
//          07.03.2025: initial version
////////////////////////////////////////////////
// Configuration - Change constants according to your configuration/needs
////////////////////////////////////////////////
// First meltem modbus device Id (modbus slave-id) in the modbus instance - default = 2 as the meltem gateway will start with 2 for connected devices
const firstDeviceId = 2;
// Number/count of devices you have configured in the modbus instance
//      the numbering is consecutive starting with 2 (e.g. numberOfDevices=2 will check the datapoints modbus.0.holdingRegisters.2 and modbus.0.holdingRegisters.3)
//      this script will currently not work if you have gaps (e.g. because you removed a device from the app/gateway or want to ignore it, let me know if that is a requirement)
const numberOfDevices = 1;
// Duration for intensive ventilation mode (in minutes) - after expiration the previous mode will be restored - default: 15
const intensiveVentilationDuration = 10; 
// Delay between writing the modbus registers for the mode setting (in ms) - default: 3000
const writeRegisterDelay = 3000
// Define the human readable mode names (only modify the second value after the colon ":")
const ventilationControlModes = {
    "Standby": "Standby",
    "Auto": "Auto Mode",
    "HumidityControl": "Humidity Control Mode",
    "CO2Control": "CO2 Control Mode",
    "Intensive": "Intensive Ventilation",
    "Balanced": "Balanced Mode",
    "Unbalanced": "Unbalanced Mode",
    "ModeLow": "Low Ventilation",
    "ModeMed": "Medium Ventilation",
    "ModeHigh": "High Ventilation",
    "unknown": "Unknown Mode"
};
//example mode names in german, replace previous definition if required
/*
const ventilationControlModes = {
    "Standby": "Standby",
    "Auto": "Automatik (Feuchte und CO2)",
    "HumidityControl": "Feuchte-Regelung",
    "CO2Control": "CO2-Regelung",
    "Intensive": "Intensivlüftung",
    "Balanced": "Manuell - balanciert",
    "Unbalanced": "Manuell - unbalanciert",
    "ModeLow": "Stufe 1",
    "ModeMed": "Stufe 2",
    "ModeHigh": "Stufe 3",
    "unknown": "Unbekannter Modus"
};
*/

////////////////////////////////////////////////
// datapoint configuration - only change if necessary
////////////////////////////////////////////////
// userdata datapoints to be created (sorry for the mix of german and english; if you want to change, you have to also adjust the mappings in the provided vis)
const dpBasePath = "0_userdata.0.meltem"; //base folder will be created if not exists
const dpAbsoluteHumiditySupplyAir = "absoluteHumiditySupplyAir";
const dpAbsoluteHumidityExtractAir = "absoluteHumidityExtractAir";
const dpModeString = "currentModeDisplayName";
const dpHeatRecoveryRate = "heatRecoveryRate";
const dpControlMode = "modeControl";
const dpVentilationLevelSupplyAir = "ventilationLevelSupplyAir";
const dpVentilationLevelExtractAir = "ventilationLevelExtractAir";

//full path (especially instance number) to the modbus holdingRegisters in which the meltem devices are connected :
const dpModbusPath = "modbus.0.holdingRegisters";
// modbus datapoint names (only modify if not using the names from the provided modbus template):
/// read datapoints
const dpModbusMode = "41100_Mode";
const dpModbusModeSupplyAir = "41101_Mode_Zuluft";
const dpModbusModeExhaustAir = "41102_Mode_Abluft";
const dpModbusSupplyAirTemperature = "41009_Supply_air_temperature";
const dpModbusExtractAirTemperature = "41000_Extract_air_temperature";
const dpModbusSupplyAirHumidity = "41011_Humidity_supply_air";
const dpModbusExtractAirHumidity = "41006_Humidity_extract_air";
const dpModbusOutdoorAirTemperature = "41002_Outdoor_air_temperature";
const dpModbusVentilationLevelExtractAir = "41020_Ventilation_level_extract_air";
const dpModbusVentilationLevelSupplyAir = "41021_Ventilation_level_supply_air";
// writing datapoints
const dpModbusSetModeType = "41120_setModeType";
const dpModbusSetModeSubType = "41121_setModeSubType";
const dpModbusSetModeExhaustFan = "41122_setModeExhaustFan";
const dpModbusSetModeConfirmWrite = "41132_setModeConfirmWrite";

////////////////////////////////////////////////


////////////////////////////////////////////////
// DO NOT CHANGE ANYTHING AFTER THIS LINE
////////////////////////////////////////////////

//create base folder
setObject(dpBasePath, { type: 'folder', common: {name: 'Calculated data for meltem devices'}, native: {} });
// Make sure that the folder/states per device exist
for(let i=firstDeviceId; i<numberOfDevices + firstDeviceId; i++) {
    setObject(dpBasePath+"."+i, { type: 'folder', common: {name: 'Calculated data for meltem device number ' + i}, native: {} });
	createState(dpBasePath+"."+i+"."+dpAbsoluteHumiditySupplyAir, 0, { type: 'number', unit: 'g/m³', read: true, write: false });
	createState(dpBasePath+"."+i+"."+dpAbsoluteHumidityExtractAir, 0, { type: 'number', unit: 'g/m³', read: true, write: false });
	createState(dpBasePath+"."+i+"."+dpModeString, ventilationControlModes["unknown"], { type: 'string', read: true, write: false });
	createState(dpBasePath+"."+i+"."+dpHeatRecoveryRate, 0, { type: 'number', unit: '%', read: true, write: false });
    // ControlMode: Selection of the modes of operation / updates with the current mode of operation from the device
    createState(dpBasePath+"."+i+"."+dpControlMode, "unknown", {
        name: "Ventilation Control Mode",
        type: "string",
        role: "value",
        read: true,
        write: true,
        def: "unknown",
        states: ventilationControlModes
    });

    // FanSpeed: ventilation level of supply air fan, values from 0 to 100 in m³
    createState(dpBasePath+"."+i+"."+dpVentilationLevelSupplyAir, 10, {
        name: "Fan speed for both fans in balanced mode or for supply air in unbalanced mode",
        type: "number",
        role: "level",
        read: true,
        write: true,
        def: 10,
        min: 0,
        max: 100
    });
    // FanSpeedOut: ventilation level of exhaust air fan, values from 0 to 100 in m³
    createState(dpBasePath+"."+i+"."+dpVentilationLevelExtractAir, 10, {
        name: "Fan speed for exhaust air in unbalanced mode",
        type: "number",
        role: "level",
        read: true,
        write: true,
        def: 10,
        min: 0,
        max: 100
    });
}

// calculation of the heat recovery rate / efficiency
function calcHeatRecoveryRate(extract, outdoor, supply) {
    if (extract === null || isNaN(extract) || outdoor === null || isNaN(outdoor) || supply === null || isNaN(supply)) {
        return null;
    }
    return ((supply - outdoor) / (extract - outdoor) * 100).toFixed(2);
}

// calculation of absolute humidity
function calcAbsoluteHumidity(h, t) {
    if (h === null || isNaN(h) || t === null || isNaN(t)) {
        return null;
    }
    return (h * 6.112 * 2.1674 * Math.exp((t * 17.67) / (t + 243.5)) / (t + 273.15)).toFixed(2);
}

// convert mode from modbus register values to a human readable string (display name)
function getModeString(modeType, modeSubType) {
    if (modeType == 1) {
        return ventilationControlModes["Standby"];
    } else if (modeType == 2) {
        if (modeSubType == 112) return ventilationControlModes["HumidityControl"];
        else if (modeSubType == 176) return ventilationControlModes["CO2Control"];
        else if (modeSubType == 48) return ventilationControlModes["Auto"];
    } else if (modeType == 3) {
        if (modeSubType == 228) return ventilationControlModes["ModeLow"];
        else if (modeSubType == 229) return ventilationControlModes["ModeMed"];
        else if (modeSubType == 230) return ventilationControlModes["ModeHigh"];
        else if (modeSubType == 227) return ventilationControlModes["Intensive"];
        else return ventilationControlModes["Balanced"];
    } else if (modeType == 4) {
        return ventilationControlModes["Unbalanced"];
    } else if (modeType == 0 && modeSubType == 0) {
        return ventilationControlModes["Intensive"];
    }
    return ventilationControlModes["unknown"];
}
// convert mode from modbus register values to mode-types
function getMode(modeType, modeSubType) {
    if (modeType == 1) {
        return "Standby";
    } else if (modeType == 2) {
        if (modeSubType == 112) return "HumidityControl";
        else if (modeSubType == 176) return "CO2Control";
        else if (modeSubType == 48) return "Auto";
    } else if (modeType == 3) {
        if (modeSubType == 228) return "ModeLow";
        else if (modeSubType == 229) return "ModeMed";
        else if (modeSubType == 230) return "ModeHigh";
        else if (modeSubType == 227) return "Intensive";
        else return "Balanced";
    } else if (modeType == 4) {
        return "Unbalanced";
    } else if (modeType == 0 && modeSubType == 0) {
        return "Intensive";
    }
    return "unknown";
}

//set state listeners for all devices)
for(let j=firstDeviceId; j<firstDeviceId + numberOfDevices + 1; j++) {
	
	// calculate absolute humidity of supply air
	on({ id: [dpModbusPath+"."+j+"."+dpModbusSupplyAirHumidity, dpModbusPath+"."+j+"."+dpModbusSupplyAirTemperature], change: "any" }, function () {
			const h = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusSupplyAirHumidity).val);
			const t = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusSupplyAirTemperature).val);
			const result = calcAbsoluteHumidity(h, t);
			setState(dpBasePath+"."+j+"."+dpAbsoluteHumiditySupplyAir, result !== null ? parseFloat(result) : 0.0, true);
	});
	
	// calculate absolute humidity of extract air
	on({ id: [dpModbusPath+"."+j+"."+dpModbusExtractAirHumidity, dpModbusPath+"."+j+"."+dpModbusExtractAirTemperature], change: "any" }, function () {
			const h = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusExtractAirHumidity).val);
			const t = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusExtractAirTemperature).val);
			const result = calcAbsoluteHumidity(h, t);
			setState(dpBasePath+"."+j+"."+dpAbsoluteHumidityExtractAir, result !== null ? parseFloat(result) : 0.0, true);
	});

	//calculate heat recovery rate / efficiency
	on({ 
			id: [
					dpModbusPath+"."+j+"."+dpModbusExtractAirTemperature, 
					dpModbusPath+"."+j+"."+dpModbusOutdoorAirTemperature, 
					dpModbusPath+"."+j+"."+dpModbusSupplyAirTemperature
			], 
			change: "any" 
	}, function () {
			const extract = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusExtractAirTemperature).val);
			const outdoor = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusOutdoorAirTemperature).val);
			const supply = parseFloat(getState(dpModbusPath+"."+j+"."+dpModbusSupplyAirTemperature).val);
			
			const wrg = calcHeatRecoveryRate(extract, outdoor, supply);
			setState(dpBasePath+"."+j+"."+dpHeatRecoveryRate, wrg !== null ? parseFloat(wrg) : 0.0, true);
	});

    // set ventilation levels from device to userdata-states
    on({ id: dpModbusPath + "." + j + "." + dpModbusVentilationLevelExtractAir, change: "any" }, async (obj)  => {
        let value = obj.state.val;
        log("dpModbusVentilationLevelExtractAir for device " + j + " changed to: " + value, "debug")
        setState(dpBasePath + "." + j + "." + dpVentilationLevelExtractAir, value, true);
    });
    on({ id: dpModbusPath + "." + j + "." + dpModbusVentilationLevelSupplyAir, change: "any" }, async (obj)  => {
        let value = obj.state.val;
        log("dpModbusVentilationLevelSupplyAir for device " + j + " changed to: " + value, "debug")
        setState(dpBasePath + "." + j + "." + dpVentilationLevelSupplyAir, value, true);
    });

    // update mode string and mode control datapoints from device
    on({ id: [dpModbusPath + "." + j + "." + dpModbusMode, dpModbusPath + "." + j + "." + dpModbusModeSupplyAir], change: "any" }, function () {
        const modbusMode = getState(dpModbusPath + "." + j + "." + dpModbusMode).val;
        const modbusModeSupplyAir = getState(dpModbusPath + "." + j + "." + dpModbusModeSupplyAir).val;
        const modeString = getModeString(modbusMode, modbusModeSupplyAir);
        const mode = getMode(modbusMode, modbusModeSupplyAir);

        setState(dpBasePath + "." + j + "." + dpModeString, modeString, true);
        setState(dpBasePath + "." + j + "." + dpControlMode, mode, true);
    });

    // handle mode control changed
    on({id: dpBasePath+"."+j+"."+dpControlMode, change: "any"}, async (obj) => {
        let value = obj.state.val;
        if(obj.state.ack) { // state was set by script - ignore
            log("Meltem: ControlMode for device " + j + " changed to: " + value + ", ignored as ACK was set", "debug")
        } else { // user set new mode, send to device
            log("Meltem: ControlMode for  device " + j + " changed to: " + value);
            
            switch(value) {
                case "Standby":
                    await setStandbyMode(j);
                    break;
                case "HumidityControl":
                    await setHumidityControlMode(j);
                    break;
                case "CO2Control":
                    await setCO2ControlMode(j);
                    break;
                case "Auto":
                    await setAutoMode(j);
                    break;
                case "Intensive":
                    await setIntensiveVentilationMode(j);
                    break;
                case "Balanced":
                    let fanSpeed = getState(dpBasePath+"."+j+"."+dpVentilationLevelSupplyAir).val;
                    await setBalancedMode(j, fanSpeed);
                    break;
                case "Unbalanced":
                    let fanSpeedIn = getState(dpBasePath+"."+j+"."+dpVentilationLevelSupplyAir).val;
                    let fanSpeedOut = getState(dpBasePath+"."+j+"."+dpVentilationLevelExtractAir).val;
                    await setUnbalancedMode(j, fanSpeedIn, fanSpeedOut);
                    break;
                case "ModeLow":
                    await setMode(j, 1);
                    break;
                case "ModeMed":
                    await setMode(j, 2);
                    break;
                case "ModeHigh":
                    await setMode(j, 3);
                    break;
                default:
                    // unknown is the initial value but should not be seen otherwise, please contact me with the values of the 3 modbus mode registers (see README in github)
                    log("Unknown mode: " + value, "warn");
            }
        }
        
    });
}

//Functions to set modes
//TODO: Abgleich ob Modus-Set Werte mit den nur-lesenden States übereinstimmen (und wo nicht muss es bei der Intensivlüftungsrücksetzung beachtet werden)
    // bei unbalanced kommt z.B. 4-204-205 für 40 out, 50 in, kann aber auch genau so wieder gesetzt werden

async function setStandbyMode(deviceid) { 
    log("setStandbyMode setState 41120 to 1", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 1);
    await sleep(writeRegisterDelay);
    log("setAutoMode setState 41121 to 0", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 0);
    await sleep(writeRegisterDelay)
    log("setStandbyMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setStandbyMode script finished", "debug")
}

async function setAutoMode(deviceid) { 
    log("setAutoMode setState 41120 to 2", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 2);
    await sleep(writeRegisterDelay);
    log("setAutoMode setState 41121 to 16", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 16);
    await sleep(writeRegisterDelay);
    log("setAutoMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setAutoMode script finished", "debug")
}

async function setHumidityControlMode(deviceid) { 
    log("setHumidityControlMode setState 41120 to 2", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 2);
    await sleep(writeRegisterDelay);
    log("setHumidityControlMode setState 41121 to 112", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 112);
    await sleep(writeRegisterDelay);
    log("setHumidityControlMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setHumidityControlMode script finished", "debug")
}

async function setCO2ControlMode(deviceid) { 
    log("setHumidityControlMode setState 41120 to 2", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 2);
    await sleep(writeRegisterDelay);
    log("setHumidityControlMode setState 41121 to 144", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 144);
    await sleep(writeRegisterDelay);
    log("setHumidityControlMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setHumidityControlMode script finished", "debug")
}

async function setIntensiveVentilationMode(deviceid) {
    log("Starting intensive ventilation mode", "info");
    
    // save the previous mode configuration
    const originalMode = getState(dpModbusPath+"."+deviceid+"."+dpModbusMode).val;
    const originalModeSupplyAir = getState(dpModbusPath+"."+deviceid+"."+dpModbusModeSupplyAir).val;
    const originalModeExhaustAir = getState(dpModbusPath+"."+deviceid+"."+dpModbusModeExhaustAir).val;
    const originalModeString = getModeString(originalMode, originalModeSupplyAir);

    // set to intensive ventilation mode
    log("setIntensiveVentilationMode setState 41120 to 3", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 3);
    await sleep(writeRegisterDelay);
    log("setIntensiveVentilationMode setState 41121 to 227", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 227);
    await sleep(writeRegisterDelay);
    log("setIntensiveVentilationMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setIntensiveVentilationMode script finished", "debug")
        
    // Warte für die konfigurierte Dauer
    await sleep(intensiveVentilationDuration * 60 * 1000);
    
    // Ursprüngliche Zustände wiederherstellen
    log("Intensive ventilation finished, previous state will be restored: "+ originalModeString, "info");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, originalMode);
    await sleep(writeRegisterDelay);
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, originalModeSupplyAir);
    await sleep(writeRegisterDelay);
    if(originalModeExhaustAir != 0) {
        setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeExhaustFan, originalModeExhaustAir);
        await sleep(writeRegisterDelay);
    }
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    
    log("Intensive ventilation mode finished", "info");
}

// set mode to predefined level: 1=LOW, 2=MED, 3=HIGH
async function setMode(deviceid, level) {
    log("setMode setState 41120 to 3", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 3);
    await sleep(writeRegisterDelay);
    log("setMode setState 41121", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, 227+level);
    await sleep(writeRegisterDelay);
    log("setMode setState 41132 to 0", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setMode script finished", "debug")
}

async function setBalancedMode(deviceid, fanSpeed) {
    log("setBalancedMode setState 41120", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 3);
    await sleep(writeRegisterDelay);
    log("setBalancedMode setState 41121", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, fanSpeed*2);
    await sleep(writeRegisterDelay);
    log("setBalancedMode setState 41132", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setBalancedMode script finished", "debug")
}

async function setUnbalancedMode(deviceid, fanSpeedIn, fanSpeedOut) {
    log("setUnbalancedMode setState 41120", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeType, 4);
    await sleep(writeRegisterDelay);
    log("setUnbalancedMode setState 41121", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeSubType, fanSpeedIn*2);
    await sleep(writeRegisterDelay);
    log("setUnbalancedMode setState 41122", "debug");
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeExhaustFan, fanSpeedOut*2);
    await sleep(writeRegisterDelay);
    log("setUnbalancedMode setState 41132", "debug")
    setState(dpModbusPath+"."+deviceid+"."+dpModbusSetModeConfirmWrite, 0);
    log("setUnbalancedMode script finished", "debug")
}
