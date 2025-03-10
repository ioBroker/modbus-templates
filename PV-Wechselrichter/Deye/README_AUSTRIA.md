Für Deye-Wechselrichter SUN5~12k gibt es in Österreich eine separate Firmware (Stand März 2025). 
![image](https://github.com/user-attachments/assets/8a224df8-a00b-47b4-a834-66eead0a67a4)

Damit stimmen die Registernummern nicht mehr. Sie ändern sich z.B.

40001 Device-Type -> 40001 minus 40001 = 0

40588 Battery Voltage -> 40588 minus 40001 = 587

usw.

Die LAN-Anbindung des Wechselrichters an den ModBus-Adapter im IoBroker erfolgt z.B. mit dem ModBus-Konverter „Waveshare RS485 to Eth“.  Die Modbus-Buchse ist offenbar in Österreich inaktiv und somit unbrauchbar. Also braucht man ein gesplittetes Cat-Kabel zwischen Deye BMS-Buchse und der CAN-Buchse der Batterie. 

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

Der Waveshare RS485-TO-ETH wird standardmäßig mit der IP 192.168.1.254 geliefert, die man ans eigene Subnetz anpasst. Die Verwendung einer statischen IP-Adresse und die Verwendung des Ports 502 wird empfohlen. Mit der Waveshare-Web-Oberfläche konfiguriert man den Konverter. 

![image](https://github.com/user-attachments/assets/cdea9cde-0c11-4503-aa6e-c1584e258269)

Weitere Einstellungen trifft man mit dem Tool VirCom_en. Wichtig ist hier die Einstellung des Modbus-Gateway Types "Simple Modbus TCP to RTU" im Button "More Advanced Settings". Nach dem Speichern müsste die Link-LED im Waveshare-Adapter blau leuchten.

![image](https://github.com/user-attachments/assets/d565a485-94b8-4661-bc7c-05c4280a030a)

Das Konfigurieren der Modbus-Instanz im IOB verläuft wie folgt, wobei besonders die Portnummer und die Modbus-Adresse von großer Bedeutung sind.

![Clipboard04](https://github.com/user-attachments/assets/8dd89a8b-8413-48c0-a56b-34ad546d2c38)

In den IOB-Objekten kann man dann die Datenpunkte verwenden:

![Clipboard05](https://github.com/user-attachments/assets/4e6a9ac7-2b9d-4d0b-9131-5568159cc406)





