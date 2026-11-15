# FoxESS H3

Holding-Register für den dreiphasigen Hybrid-Wechselrichter FoxESS H3 (H3-5.0-E bis H3-12.0-E). Nach
[foxess_modbus](https://github.com/nathanmarlor/foxess_modbus) nutzen auch AC3 und AIO-H3 dieselben Register.

**Nicht** für H3-Smart und H3-Pro: diese Modelle nutzen andere Register (39xxx).

## Anschluss

RS485 am Wechselrichter, direkt (Modbus RTU) oder über einen RS485-LAN-Wandler (Modbus TCP oder RTU over TCP).

## Einstellungen im Modbus-Adapter

* Alle Werte sind **Holding-Register** (Funktionscode 3), auch die nur lesbaren Messwerte.
* Adressen sind roh (wie im Datenblatt), Option "Show aliases" ausschalten.
* Slave-ID: wie am Wechselrichter eingestellt (Standard 247).

## Hinweise

* Zähler-Leistung (31026-31028): positiv = Einspeisung, negativ = Netzbezug.
* Batterie-Leistung (31036): positiv = Entladen, negativ = Laden.
* Arbeitsmodus (41000, schreibbar): 0 = Self Use, 1 = Feed-in First, 2 = Back-up, 4 = Peak Shaving.
* Energiezähler (32000-32023) in 0,1 kWh, die Gesamtwerte sind 32 Bit (High-Word zuerst).
* Die Faktoren von 31039/31040 (max. Lade-/Entladestrom) sind nicht verifiziert.

## Quelle

Registerliste eines ioBroker-Nutzers, Faktoren und Vorzeichen abgeglichen mit
[foxess_modbus](https://github.com/nathanmarlor/foxess_modbus) (MIT).
