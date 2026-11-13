# Eastron SDM54-M MID

Dreiphasiger Energiezähler von Eastron (Hutschiene, 4 TE, MID-geeicht) mit Modbus RTU über RS485.

Die Vorlage läuft so seit langer Zeit produktiv und stabil an einem SDM54-M MID über einen RS485/Modbus-TCP-Gateway.

## Einstellungen der Instanz

| Einstellung | Wert |
|---|---|
| TCP/Serielle RTU | TCP (über RS485-Gateway) oder Seriell RTU direkt |
| Mode | Master |
| Port | 502 |
| Geräte-ID | 1 (ab Werk, am Zähler einstellbar) |
| Aliases benutzen | **Ja** (Adressen 3xxxx) |
| Direkte Adressen benutzen | Nein |
| Seriell (Zähler ab Werk) | 9600 Baud, 8 Datenbits, keine Parität, 1 Stoppbit |

Beim Import über die Vorlagenbibliothek des Adapters werden die Adressen automatisch an die Einstellung „Aliases benutzen“ der Instanz angepasst.

## Register

`input-registers.tsv` (alle Werte `floatbe`, 2 Register):

* Spannung, Strom, Wirk-, Schein- und Blindleistung sowie Leistungsfaktor je Phase
* Durchschnittsspannung, Durchschnitts- und Summenstrom
* Gesamt-Wirk-, -Schein- und -Blindleistung, Gesamt-Leistungsfaktor, Netzfrequenz
* Wirkenergie Bezug / Einspeisung / gesamt, Blindenergie Bezug / Einspeisung / gesamt

Die Rollen folgen den [State-Rollen](https://www.iobroker.com/docs/dev/stateroles.md) (`value.voltage`, `value.current`, `value.power.active`, `value.power.reactive`, `value.frequency`, `value.energy.*`). Für Scheinleistung und Leistungsfaktor gibt es keine eigene Rolle, daher `value`.

## Geräte-Erkennung

Der Zähler meldet im Holding-Register FC02h (Meter Code) den Wert 217.
