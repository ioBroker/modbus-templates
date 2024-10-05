# GoodWe Modbus Protokol Hybrid

# *Alle durchgeführten Änderungen am Inverter und seiner Komponenten sind auf eigene Gefahr!!!*

## Kompatieble Inverterserien
- ET PLUS+ Serie
- ET PLUS+ (16A) Serie
- ET (15-30 kW) Serie
- BT Series
- EH Serie
- EH PLUS+ Serie
- ES Serie
- ES G2 Serie
- SBP Serie
- SBP G2 Serie
- BH Serie
- ESA Serie
- EM Serie
- ETC Serie
- BTC Serie

## Gestestete Inverter

|Modell        |ARM       |DSP       |BMS       |Produktserie         |Anmerkung                  |
|--------------|----------|----------|----------|---------------------|---------------------------|
|GW25K-ET      |08.401    |07.7068   |06        |ET (15-30 kW) Serie  |LX F16.4-H, keine Wallbox  |

## Nötige Hardware

Es wir der zum Inverter jewails passende Dongle benötigt um Modbus/TCP freizuschalten. Aktuell ist Modbus/TCP nur über LAN möglich.

- Wi-Fi/LAN Kit
- Wi-Fi/LAN Kit-20

Alternativ mit einem Wandler direkt am Modbus/RTU des Inverters.

## Anmerkungen / Probleme / Fehler
- **alle Register müssen als "Holding Register" behandelt werden!**
- die Übersetzung wurde von mir teilweise etwas überarbeitet so lange logisch Herleitbar (Google Übersetzer)
- Tabellen die mit "ohne Funktion" gekennzeichnet sind enthalten Register die nicht lesbar sind
- Register die R/o oder R/W sind aber Probleme bei mir machen sind Poll "false"
- ETC / BTC Register sind ohne passenden Inverter generell nicht lesbar
- Register zu Funktionen die aktiviert werden müssen haben meistens einen "0" Wert
- wenn in einem Leseblock (default 100 Register) das **erste Register** auch nicht über die SolarGo App --> Geräte Debugging gelesen werden kann blockiert das **alle Register** in dem Block
- Register 45552 - 45569 via ioBroker nicht lesbar nur mit SolarGo --> Geräte Debugging und nur mit Startregister =>45552

## Undokumentierte Register aber eingepflegt

### 47120 Meter Target Power Offset (info aus dem PV-Forum)
- R/W Register
- int16be Datentyp
- Faktor 1
- ein negativer Wert in Watt verschiebt den mittleren Wert von 0W weiter richtung Bezug
- ein positiver Wert in Watt verschiebt den mittleren Wert von 0W weiter richtung Einspeisung
- **möglicherweise nur bei ET (15-30 kW) Serie Invertern mit der Funktion verfügbar**

## Einstellungen im Adapter für Modbus/TCP
Als Geräte ID **darf auf keinen Fall** die in der SolarGo App verwendete eingetragen werden! Dies gilt auch für Systeme mit mehreren Goodwe Invertern (jeder hat seine individuelle ID). Dadurch kommt es sonst zu kollisionen mit dem SEMS-Portal, Datenverlust und Verbindungsabbrüchen.

Können einzelne Register nicht gelesen werden kann testweise "Max Leseanforderungslänge (Float)" auf 1 gesetzt werden.

![grafik](https://github.com/user-attachments/assets/8b54363c-555c-4620-a2d2-c542ff79c4dc)
 ![grafik](https://github.com/user-attachments/assets/a59337ea-a4b5-4454-9d30-c204fda12c73)

## Quellen
Leider sind mir die Quellen von den PDF abhanden gekommen. Vermutlich im PV-Forum gefunden.
[BESS Modbus protocol Map V1.1 20231030.pdf](https://github.com/user-attachments/files/17229994/BESS.Modbus.protocol.Map.V1.1.20231030.pdf)

[ARM 745, ESG2,ET30 MODBUS Protocol Map 20221231 - v1.pdf](https://github.com/user-attachments/files/17234759/ARM.745.ESG2.ET30.MODBUS.Protocol.Map.20221231.-.v1.pdf)
