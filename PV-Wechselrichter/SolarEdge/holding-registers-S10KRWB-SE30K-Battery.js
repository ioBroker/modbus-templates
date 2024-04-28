
var last_SE10K_I_DC_Power = 0;
var last_SE30K_I_DC_Power = 0;
var last_Battery1_InstantaneousPower = 0;
var last_SE10K_I_AC_PV_Power = 0;
var last_I_AC_Power = 0;
var last_SE10K_I_AC_Power = 0;
var last_SE30K_I_AC_Power = 0;
var last_M_AC_Power = 0;
var tempState;
var last_Battery1_SOE = 0;

function precisionRound(number, precision) {
  var factor = Math.pow(10, precision);
  return Math.round(number * factor) / factor;
}


createState('SolarEdge.SE10K.I_AC_Power', {
	name: 'I_AC_Power',
	unit: 'W',
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.SE10K.I_AC_PV_Power', {
	name: 'I_AC_PV_Power',
	unit: 'W',
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.SE10K.I_DC_Power', {
	name: 'I_DC_Power',
	unit: 'W',
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.SE30K.I_AC_Power', {
	name: 'I_AC_Power',
	unit: 'W',
	min:  0,
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.SE30K.I_DC_Power', {
	name: 'I_DC_Power',
	unit: 'W',
	min:  0,
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.Battery1.InstantaneousPower', {
	name: 'InstantaneousPower',
	unit: 'W',
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.I_AC_Power', {
	name: 'PV',
	unit: 'W',
	min:  0,
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.Used_Power', {
	name: 'Haus',
	unit: 'W',
	min:  0,
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.M_AC_Power', {
	name: 'SolarEdge.M_AC_Power',
	unit: 'W',
	type: 'number',
	role: 'value.energy'
});

createState('SolarEdge.Import_Export_Status', {
	name: 'SolarEdge.Import_Export_Status',
	min:  0,
	type: 'number'
});

createState('SolarEdge.Battery1.SOE', {
	name: 'SOE',
	unit: '%',
	min:  0,
	type: 'number',
	role: 'value.battery'
});


//
// Beim Start die Variablen mit den aktuellen Werten füllen
//
// Batterie:
tempState = getState('modbus.0.holdingRegisters.1.97733_Battery_1_State_of_Energy').val;
last_Battery1_SOE = precisionRound((tempState >= 0 && tempState <= 100) ? tempState : 0, 1);
setState('SolarEdge.Battery1.SOE', last_Battery1_SOE, true);
last_Battery1_InstantaneousPower = getState('modbus.0.holdingRegisters.1.97717_Battery_1_Instantaneous_Power').val;

// Wechselrichter SE10K-RWB48
last_SE10K_I_DC_Power = getState('modbus.0.holdingRegisters.1.40101_I_DC_Power').val;
last_SE10K_I_AC_Power = Math.round(getState('modbus.0.holdingRegisters.1.40084_I_AC_Power').val);

// Wechselrichter SE30K
last_SE30K_I_DC_Power = getState('modbus.0.holdingRegisters.2.40101_I_DC_Power').val;
last_SE30K_I_AC_Power = Math.round(getState('modbus.0.holdingRegisters.2.40084_I_AC_Power').val);

// Einspeise/Bezugszähler
last_M_AC_Power = getState('modbus.0.holdingRegisters.1.40207_M_AC_Power').val;

//
// Änderungen erkennen und in die Variablen schreiben
//
// AC_Power
on({id:/^modbus\.0\.holdingRegisters\.[1-2]\.40084_I_AC_Power$/, change:'ne'}, function(obj) {

    switch(obj.id) {
        case 'modbus.0.holdingRegisters.1.40084_I_AC_Power':
            last_SE10K_I_AC_Power = Math.round(obj.state.val);
            break;
        case 'modbus.0.holdingRegisters.2.40084_I_AC_Power':
            last_SE30K_I_AC_Power = Math.round(obj.state.val);
            break;
    }
});

// Batterieleistung
on({id:'modbus.0.holdingRegisters.1.97717_Battery_1_Instantaneous_Power', change:'ne'}, function(obj){
    last_Battery1_InstantaneousPower = obj.state.val;
});

// Batterie State of Energy
on({id:'modbus.0.holdingRegisters.1.97733_Battery_1_State_of_Energy', change:'ne'}, function(obj){
    var temp = precisionRound((obj.state.val >= 0 && obj.state.val <= 100) ? obj.state.val : -1, 1);
    if (temp >= 0){
        last_Battery1_SOE = temp;
        setState('SolarEdge.Battery1.SOE', last_Battery1_SOE, true);
    }
});

// DC-Leistung der Wechselrichter
on({id:/^modbus\.0\.holdingRegisters\.[1-2]\.40101_I_DC_Power$/, change:'ne'}, function(obj) {
    switch(obj.id) {
        case 'modbus.0.holdingRegisters.1.40101_I_DC_Power':
            last_SE10K_I_DC_Power = obj.state.val;
            break;
        case 'modbus.0.holdingRegisters.2.40101_I_DC_Power':
            last_SE30K_I_DC_Power = obj.state.val;
            break;
    }
});

// Wieviel Leistung wird aktuell aus dem Netz bezogen?
on({id:'modbus.0.holdingRegisters.1.40207_M_AC_Power', change:'ne'}, function(obj) {
    last_M_AC_Power = obj.state.val;
});

// Jede Sekunde die Werte in die Objekte schreiben
schedule("* * * * * *", function() {

    // Aktuelle PV-Leistung DC
    setState('SolarEdge.SE10K.I_DC_Power', last_SE10K_I_DC_Power, true);
    setState('SolarEdge.SE30K.I_DC_Power', last_SE30K_I_DC_Power, true);
    var SE10K_I_DC_PV_Power = last_SE10K_I_DC_Power + last_Battery1_InstantaneousPower;
    if (SE10K_I_DC_PV_Power < 0) {
        SE10K_I_DC_PV_Power = 0;
    }
    var SE10K_I_DC_Batt_Power = -1 * Math.round(last_Battery1_InstantaneousPower * 0.976);

    // Batterie
    setState('SolarEdge.Battery1.InstantaneousPower', last_Battery1_InstantaneousPower, true);

    // Aktuelle PV-Leistung AC
    // I_AC_Power aus I_DC_Power errechnen indem 97,6% Wirkungsgrad (laut Datenblatt) angenommen wird.
    last_SE10K_I_AC_PV_Power = Math.round(SE10K_I_DC_PV_Power * 0.98);
    last_I_AC_Power = last_SE10K_I_AC_PV_Power + last_SE30K_I_AC_Power;
    setState('SolarEdge.SE10K.I_AC_Power', last_SE10K_I_AC_Power, true);
    setState('SolarEdge.SE10K.I_AC_PV_Power', last_SE10K_I_AC_PV_Power, true);
    setState('SolarEdge.SE30K.I_AC_Power', last_SE30K_I_AC_Power, true);
    setState('SolarEdge.I_AC_Power', last_I_AC_Power, true);

    // Differenz zwischen PV-Leistung, Batterieleistung und Netzbezug ergibt Eigenverbrauch
    setState('SolarEdge.Used_Power', last_I_AC_Power + SE10K_I_DC_Batt_Power - last_M_AC_Power, true);

    // Der Zähler gibt die Information, wieviel exportiert/importiert wird
    setState('SolarEdge.M_AC_Power', Math.abs(last_M_AC_Power), true);
    setState('SolarEdge.Import_Export_Status', last_M_AC_Power > 0 ? 1 : 0, true);

});
