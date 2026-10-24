# Windhager BioWIN2

Modbus-Register für den Pelletkessel Windhager BioWIN2.

Quelle: Issue [#67](https://github.com/ioBroker/modbus-templates/issues/67) von [chrira2507](https://github.com/chrira2507)

## Dateien

| Datei | Inhalt |
| -------- | ------- |
| `holding-registers.tsv` | Temperaturen (Außen, Vorlauf HK1/HK2, Warmwasser, Puffer, Kessel, Abgas, Brennkammer), Kesselleistung, Betriebsphase, Restlaufzeiten Reinigung/Wartung, Pelletsverbrauch |
| `input-registers.tsv` | Füllgrad Brennstoffbehälter und Lagerraum, Anzahl Brennerstarts, Betriebsstunden |

Alle Register sind mit Geräte-ID `1` angelegt. Falls euer Gerät eine andere ID verwendet, muss diese nach dem Import angepasst werden.
