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

## Other SolarEdge inverters and Home Battery

- SE10K-RWB48
- SE30K
- SE Home Battery

Use 'holding-registers-S10KRWB-SE30K-Battery.tsv'.

As it is not easy to determine the DC power for SE hybrid inverters, here is the appropriate ioBroker Javascript for the holding register:
'holding-registers-S10KRWB-SE30K-Battery.js'.
