# Alpha-ESS inverter systems

---

## Note

- Currently, `holding_register.txt` contains only a small subset of possible registers.
- `holding_register.txt` contains settings for Smile5 HW revision one. It is known that some types and factors differ between Alpha-ESS systems and software versions, so check carefully if the settings match to your system.

## Compatible inverters

| model                | supported Modbus         |
| -------------------- | ------------------------ |
| Smile5 HW revision 1 | (Modbus RTU)             |
| Smile5 HW revision 2 | (Modbus RTU, Modbus TCP) |
| T10                  | (Modbus RTU)             |
| Hi5                  | (Modbus RTU, Modbus TCP) |
| Hi10                 | (Modbus RTU, Modbus TCP) |
| ...                  |                          |

## Settings

It is recommended to **uncheck** the option "Use aliases".

### Modbus RTU

RJ45 port is named depending on model either "LAN2" (older models) or "CAN" (newer models since 2020).
Wiring RJ45 -> RS485: 4->B, 5->A.
Settings: 9600bps, 1 start bit, 8 data bits, no Parity, 1 stop pbit
Device ID: 85

### Modbus TCP

Use standard Modbus TCP settings and device ID 85
