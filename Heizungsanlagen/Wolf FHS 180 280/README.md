# Wolf FHS 180 / FHS 280

Holding- und Input-Register für die Warmwasser-Wärmepumpen Wolf FHS 180 und FHS 280
(FHS-180-S-230V-e2-M2, FHS-280-S-230V-e2-M2, FHS-280-HE-230V-e2-M2).

## Anschluss

* Modbus RTU über RS485, 8 Datenbits, 1 Stoppbit bei Parität gerade/ungerade, 2 Stoppbits ohne Parität
* Adresse, Baudrate (19200 oder 9600) und Parität werden am Gerät eingestellt (Register 114 bis 116)
* Schreiben über Modbus muss am Gerät erlaubt sein (Register 117 `ModbusAllowWrite` = 1)
* 120 Ohm Abschlusswiderstand zwischen A und B am ersten und letzten Gerät des Busses

## Hinweise

* Adressen wie im Datenblatt (ohne Alias-Offset).
* `Defrost` (Abtauart) soll laut Wolf nicht verändert werden.
* `FanOper` hat beim AC-Lüfter die Werte 0..1, beim EC-Lüfter 0..3.
* `FanPause`: im Datenblatt sind alle Werte ab 1 mit "1 =" beschriftet; die Vorlage zählt sie der Reihe nach (1..6).
* `Status` und `Unit_Alarm` sind Bitfelder, die Bedeutung der Bits ist nicht dokumentiert.

## Quelle

* Wolf Betriebsanleitung Warmwasser-Wärmepumpe FHS-280-S-230V-e2-M2 / FHS-280-HE-230V-e2-M2 (9148345_202204),
  Kapitel 9.4 "Modbus-Parameter"
* Erste Version: Issue [#45](https://github.com/ioBroker/modbus-templates/issues/45) von [PV-Georg](https://github.com/PV-Georg)
