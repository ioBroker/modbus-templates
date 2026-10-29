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
- blueplanet 5.0 TL3 / 10.0 TL3 -> `holding-registers_blueplanet_tl3.tsv` (SunSpec models 113 + 160: AC values per phase, total yield, temperature, operating state, DC values per MPPT, power limitation; Modbus TCP via LAN, see [#6](https://github.com/ioBroker/modbus-templates/issues/6))
  

## Info

- use holding register
- when using multi-device, use `holding-registers_blueplanet_nx3_m2-multidevice.tsv` and change device ID to match your device

## Power limitation (blueplanet TL3)

1. Write the timeout to `40297` (`Begrenzung_Timeout`, seconds). The inverter resets this register itself, so write it every time.
2. Write the setpoint to `40295` (`Leistungsbegrenzung_Sollwert`, % of rated power)
3. Write `1` to `40299` (`Leistungsbegrenzung_Aktiv`) to apply the limit

To remove the limit, write `100` to `40295` (keep `40299` = 1). Writing `0` to `40299` does **not** lift an active limit; the inverter keeps it until the timeout expires. To keep a limit active, rewrite it before the timeout runs out.
