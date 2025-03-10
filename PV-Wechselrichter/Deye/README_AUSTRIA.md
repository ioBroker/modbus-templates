Für Deye-Wechselrichter SUN5~12k gibt es in Österreich eine separate Firmware. Damit stimmen die Registernummern nicht mehr. Sie ändern sich z.B.
40001 Device-Type -> 40001 minus 40001 = 0
40588 Battery Voltage -> 40588 minus 40001 = 587
usw.

Die Anbindung des Wechselrichters an den IoBroker-ModBud-Adapter erfolgt z.B. mit dem ModBus-Konverter „Waveshare RS485 to Eth“.  Die Modbus-Buchse ist offenbar in Österreich inaktiv und somit unbrauchbar. Also braucht man ein gesplittetes Cat-Kabel zwischen Deye BMS-Buchse und der CAN-Buchse der Batterie. 

Dieses CAT-7-Kabel verwendet folgende Drähte:

Deye-BMS-Kabel auftrennen und die Drähte 6, 7 und 8 mit einem neuen CAT-Kabel verlöten:
1 = 485B
2 = 485A
6 = GND weiß/blau
7 = 485A orange
8 = 485B weiß/orange

Converter RS485 to Eth-Pins mit dem neuen CAT-Kabel verbinden:
GND weiß/blau
485B weiß/orange
485A orange

![02_Hardware](https://github.com/user-attachments/assets/8a4e179f-d464-4afd-a43a-26ea9e0b8a94)

Wichtig ist das Einstellen der Modbus-Adresse am Deye (Menü erweiterte Einstellungen - Modbus SN). Die Adresse 00 soll nicht verwendet werden.

![03_Deye WR](https://github.com/user-attachments/assets/46b871b0-3910-4f9f-b33f-342478050baa)

Mit dem Tool VirCom_en konfiguriert man den Konvverter. Wichtig ist hier die Einstellung des Modbus-Gateway Types "Simple Modbus TCP to RTU" im Button "More Advanced Settings". Nach dem Speichern müsste die Link-LED im Waveshare-Adapter blau leuchten.

![04_VirCom](https://github.com/user-attachments/assets/0440f15f-ac91-4a24-9967-28ba148594c9)

Das Konfigurieren der Modbus-Instanz im IOB verläuft wie folgt, wobei besonders die Portnummer und die Modbus-Adresse von großer Bedeutung sind.

![05_Modbus1](https://github.com/user-attachments/assets/ca05ef91-e1bf-4952-8eb6-322974d1f569)




