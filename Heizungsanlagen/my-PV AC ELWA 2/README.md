# my-PV AC ELWA 2

Holding-Register des Photovoltaik-Heizstabs my-PV AC ELWA 2 (Modbus TCP, Port 502, Geräte-ID 1).

## Einstellungen am Gerät

* Im Webinterface oder am Display unter "Ansteuerung" den Ansteuerungstyp **Modbus TCP** wählen, sonst nimmt der
  AC ELWA 2 keine Leistungsvorgabe an.
* Die Leistungsvorgabe (`Power`, 1000) muss regelmäßig wiederholt werden, schneller als der eingestellte Zeitablauf
  (`Power_timeout`, 1004). Dafür beim Register 1000 im Adapter "Zyklisch schreiben" (cw) einschalten oder die Vorgabe
  per Skript wiederholen.

## Hinweise

* Adressen wie in der Doku von my-PV (ohne Alias-Offset).
* Laut my-PV dürfen beschreibbare Register höchstens einmal am Tag geschrieben werden, außer 1000, 1009 bis 1012 und
  1078 bis 1080. Sie sind in der Beschreibung markiert.
* Für 1029, 1074, 1075 und 1082 gibt es nur die Namen aus dem Forum, die Bedeutung ist nicht aus einer Doku belegt.

## Quellen

* Register aus dem ioBroker-Forum von warp735 ([Beitrag](https://forum.iobroker.net/topic/85813/modbus-vorlagen-fast-fertig-2-ger%C3%A4te-fehlen-noch/7)),
  im Betrieb mit mehreren AC ELWA 2 erprobt
* Bedeutung, Status- und Betriebsartwerte abgeglichen mit
  [gojux/mypv_elwa2_modbus](https://github.com/gojux/mypv_elwa2_modbus) (MIT, nach "AC ELWA 2 - Documentation of
  Controls" von my-PV) und dem my-PV-Treiber von [evcc](https://github.com/evcc-io/evcc/blob/master/charger/mypv.go)
