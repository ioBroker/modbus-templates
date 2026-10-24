# KACO new energy Inverter

## Communication settings

| parameter | value |
| --- | --- |
| Baudrate | 9600 baud |
| Data bits | 8   |
| Parity | none |
| Stop bits | 1   |
| Flow control | none |

Server listens on port 502

## compatible KACO new energy inverters

- blueplanet 3.0 NX3 M2 – 20.0 NX3 M2 -> `holding-registers_blueplanet_nx3_m2.tsv`
- blueplanet 5.0 TL3 / 10.0 TL3 -> `holding-registers_blueplanet_tl3.tsv` (only total generation and yield, Modbus TCP via LAN, see [#6](https://github.com/ioBroker/modbus-templates/issues/6))
  

## Info

- use holding register
- when using multi-device, use `holding-registers_blueplanet_nx3_m2-multidevice.tsv` and change device ID to match your device