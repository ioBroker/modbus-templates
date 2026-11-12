# Sofar Solar / ZCS Azzurro HYD 5-20K

Holding-Register für die Hybrid-Wechselrichter Sofar Solar bzw. ZCS Azzurro HYD 5K bis 20K.

Die meisten Register sind mit `poll = false` angelegt. Benötigte Werte nach dem Import auf `poll = true` setzen.

Quelle: Issue [#65](https://github.com/ioBroker/modbus-templates/issues/65) von [helge-dot](https://github.com/helge-dot)

## Vollständige Registerliste aus ha-solarman (automatisch erzeugt)

[ha-solarman-g3hyd.tsv](ha-solarman-g3hyd.tsv) wird von der GitHub Action aus der Definition
[sofar_g3hyd.yaml](https://github.com/davidrapan/ha-solarman/blob/main/custom_components/solarman/inverter_definitions/sofar_g3hyd.yaml)
von [ha-solarman](https://github.com/davidrapan/ha-solarman) (MIT, © David Rapan and contributors) erzeugt und
wöchentlich aktualisiert (Eintrag `generate` in `template.json`). Bitte nicht von Hand ändern, sie wird überschrieben.

- Sofar G3 Protokoll V1.22 (3-phasig), laut ha-solarman auch für ZCS Azzurro 3PH HYD…ZSS und 1PH HY…ZSS HP. Nicht
  über ZCS Connext, nur mit WLAN-/Ethernet-Kit (z. B. ZSM-WIFI-USB) oder RS485.
- Rohadressen, alle Register gepollt (`poll = true`); nicht benötigte vor dem Speichern abwählen.
- Netz-Leistungen (`*_PCC_*`) sind mit negativem Faktor invertiert (Bezug positiv), wie in ha-solarman.
- Korrigiert gegenüber ha-solarman (`override` in `template.json`): Blindleistung in var statt kvar, Scheinleistung
  Faktor 10 VA (Protokoll: 0,01 kVA) statt 0,1.
- `Device Fault` (1029–1040) wird als Hex-Text gelesen: Fehlerbits, Bedeutung in der Beschreibung.
