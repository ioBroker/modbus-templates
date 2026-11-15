# FoxESS H3

Holding-Register für den dreiphasigen Hybrid-Wechselrichter FoxESS H3 (H3-5.0-E bis H3-12.0-E). Nach
[foxess_modbus](https://github.com/nathanmarlor/foxess_modbus) nutzen auch AC3 und AIO-H3 dieselben Register.

**Nicht** für H3-Smart und H3-Pro: diese Modelle nutzen andere Register (39xxx, Arbeitsmodus 49203).

## Anschluss

Über die RS485-Schnittstelle des Wechselrichters, direkt (Modbus RTU, z. B. USB-RS485-Adapter) oder über einen
RS485-LAN/WLAN-Wandler wie Elfin EW11A oder USR (Modbus TCP oder RTU over TCP).

Der LAN-Port bzw. der LAN-Dongle des H3 bietet kein Modbus TCP (Port 502 ist zu, getestet mit Master 1.25-1.57,
Slave 1.02, Manager 1.29).

## Einstellungen im Modbus-Adapter

* 9600 Baud, 8 Datenbits, keine Parität, 1 Stoppbit
* Slave-ID: Standard 247, am Wechselrichter unter Einstellungen → Kommunikation → RS485 → Device ID
* Alle Werte sind **Holding-Register** (Funktionscode 3), auch die nur lesbaren Messwerte.
* Adressen sind roh (wie im Datenblatt), Option "Show aliases" ausschalten.

## Hinweise

* Zähler-Leistung (31026-31028): positiv = Einspeisung, negativ = Netzbezug.
* Batterie-Leistung (31036): positiv = Entladen, negativ = Laden.
* Wechselrichter-Zustand (31041): 1 = Selbsttest, 2 = Netzbetrieb, 3 = Notstrom (EPS), 4/5 = Fehler, 8 = Leerlauf.
* Arbeitsmodus (41000, schreibbar): 0 = Self Use, 1 = Feed-in First, 2 = Back-up, 4 = Peak Shaving.
* Energiezähler (32000-32023) in 0,1 kWh, die Gesamtwerte sind 32 Bit (High-Word zuerst).
* Die Register sind von der Community ermittelt, nicht von FoxESS veröffentlicht. Sie können sich mit der Firmware
  ändern.

## Quellen

* Registerliste eines ioBroker-Nutzers
* [foxess_modbus](https://github.com/nathanmarlor/foxess_modbus) (MIT): Faktoren, Vorzeichen, Arbeitsmodi, Modellnamen
* [HA-FoxESS-H3-Modbus](https://github.com/rsaemann/HA-FoxESS-H3-Modbus) und dessen
  [Register-Wiki](https://github.com/rsaemann/HA-FoxESS-H3-Modbus/wiki/H3-Modbus-Registers): Anschluss, Fehlercodes,
  Zustände
* [marklabs.pl](https://marklabs.pl/en/foxess-esphome-modbus-direct-register-reading/): BMS-Verbindungsstatus (31042)
