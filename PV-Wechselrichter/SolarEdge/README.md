# SolarEdge Inverter (e.g. SE8K)

---------------------------------------------------------

## Compatible SolarEdge inverters

- SE3K
- SE4K
- SE5K
- SE6K
- SE7K
- SE8K
- SE9K
- SE10K

Use `holding-registers.tsv`.

## Compatible SolarEdge Energy Meters

- MTR-240-3PC1-D-A-MW

Use `holding-registers-meter1.tsv`. *Also includes all registers of the inverter.*

## Battery - SolarEdge Home Battery

Use `holding-registers-meter-battery.tsv`. *Includes inverter, energy meter and battery.*

## Other SolarEdge inverters and Home Battery

- SE10K-RWB48
- SE30K
- SE Home Battery

Use 'holding-registers-S10KRWB-SE30K-Battery.tsv'.

As it is not easy to determine the DC power for SE hybrid inverters, here is the appropriate ioBroker Javascript for the holding register:
'holding-registers-S10KRWB-SE30K-Battery.js'.

## Special registers for battery since FW 0004.0024.0009 (CPU 4.24.9)

before this registers could be read as uint32besw -> This is not possible anymore, you will get an timeout for whole modbus adapter.

- 97719 - Batt1_DisCharge in Wh (read as uint64be without formular factor 1000 -> not uint64le)
- 97723 - Batt1_Charge in Wh  (read as uint64be without formular factor 1000 -> not uint64le)

Use following script to rewrite to correct values in Wh. Important the values are set to 0 at least once a day directly from inverter (usually not midnight). For daily create a seperate script that uses this values as raw input and adding allways the delta only.
'SolarEdgeBatteryDailyEnergyDecoder.js'
