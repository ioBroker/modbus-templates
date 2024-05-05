# Phoenix Contact Messgeräte EEM-EM3xx / EEM-DM3xx

## Kompatieble Messgeräte:
### Getestet
|Modell        |Item No.        |Firmware     |
|--------------|----------------|-------------|
|EEM-EM377     | 2908590        |1.0.7        |

### Ungetestet
|Modell        |Item No.        |
|--------------|----------------|
| EEM-DM357-70 | 1219095        |
| EEM-DM357    | 1252817        |
| EEM-EM355    | 2908578        |
| EEM-EM357    | 2908588 (EOL?) |
| EEM-EM375    | 2908581        |

## Probleme / Fehler mit dem EEM-EM377:
- Fehlender Support für Signed 64Bit in ioBroker.modbus Adapter (6.2.2) --> es gibt aber immer ein Register mit gleichen Inhalt als Float
- in wenigen Fällen ist der Datentyp im Handbuch vermutlich falsch oder fehlte --> wurde geändert so weit testbar
- Register Modbus/RTU betreffend konnten nicht getestet werden
- Register für Tarif 1 und 2 betreffend konnten nicht getestet werden sollten aber funktionieren mit einem passenden Gerät


## Einstellungen im Adapter für Modbus/TCP:
![grafik](https://github.com/Gugulao/modbus-templates/assets/76453304/88846a6f-7c02-4176-8b81-5c42f074690d)
![grafik](https://github.com/Gugulao/modbus-templates/assets/76453304/fed2aefd-69ce-4e1b-8431-b9759b042d29)

## Quellen:
https://www.phoenixcontact.com/de-de/produkte/energiezaehler-eem-em377-2908590
