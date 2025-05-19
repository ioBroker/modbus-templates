# Meltem M-WRG and M-WRG-II
Control Meltem M-WRG and M-WRG-II devices via modbus in iobroker
Author: boriswerner (https://github.com/boriswerner/)
Feel free to post issues in the iobroker forum (https://forum.iobroker.net/topic/79658/modbus-rtu-mit-meltem-m-wrg-ii-%C3%BCber-meltem-gateway) or as an issue at https://github.com/boriswerner/modbus-templates/issues

Highly inspired by Home Assistant user da_anton, Thank you very much! (see https://community.home-assistant.io/t/meltem-wrg-ii-integration-via-meltem-gateway-and-modbus/720906)

## Prerequisites:
Meltem M-WRG or M-WRG-II device(s) that is compatible with either modbus or the app gateway (according to Meltem all devices starting with year of construction 2020 are compatible with the app gateway, older devices can be connected according to the info sheet but you need to get in touch with Meltem support, maybe some sort of upgrade board is required).

It has been built and tested with the Meltem devices "M-WRG-II P-F" (normal version with humidity sensors) and "M-WRG-II E-F" (enthalpie version with humidity sensors) and the app gateway "M-WRG-GW".
The datapoints and controls for C02 versions (FC) are also provided but have no effect on non-C-versions and are not tested.

### modbus connection via app gateway M-WRG-GW
The app gateway needs to be setup according to the manual (https://www.meltem.com/fileadmin/downloads/documents/Meltem%20IA-BA_M-WRG-GW.pdf) and devices connected with the meltem android or ios app.
You then need to connect the gateway with a USB cable (the provided one didn't work stable for me and seemingly others, so please use a high quality cable to prevent issues) to your iobroker host. Please make sure the provided power from the USB port is sufficient as the gateway will be powered from this port.

*Gateway USB forwarding to a Proxmox LXC*
I am using iobroker in a Proxmox LXC container. The "old" method of forwarding USB devices with udev rules was not working stable. The device was disconnected from time to time, leading to an undefined error in the modbus instance. Please use the "new" method (onyl Proxmox >8.2) with device passthrough via the GUI (see https://www.youtube.com/watch?v=FlMuxDABXEI).

### modbus versions without the gateway
In theory it should be compatible with the modbus versions M-WRG-II P-M / E-M (F, FC) / M-WRG-S M (F, FC). But I don't have any info about the possible modbus master and required connections.

There are some things to consider that I know of:
- According to the manual (https://www.meltem.com/fileadmin/downloads/documents/Meltem%20BA-IA_M-WRG-II_P-M_E-M%20EN.pdf) and the info found on the home assistant description (https://community.home-assistant.io/t/meltem-wrg-ii-integration-via-meltem-gateway-and-modbus/720906), the registers 41000 and 41004 are reversed between modbus versions and the app gateway so please check and modify if necessary
- The device IDs in the app gateway are consecutive starting with 2 in order of connection to the app. I have no info on the modbus versions (I think they can be assigned when ordering) so you have to modify this as well (see modbus configuration and control script config).

## Configuration of Modbus-Adapter:
When using the app gateway the following settings have to be used:

### Verbindungsparameter
| Einstellung | Ausprägung | Kommentar |
| -------- | ------- | ------- |
| TCP/Serielle RTU | Serial | |
| Port | /dev/serial/by-id/usb-Honeywell_Modbus_480787B6B-if00 | please check your serial-id or serial-port |
| Baudrate | 19200 | |
| Data bits | 8 | |
| Stop bits | 1 | |
| Parität | even | |
| Device ID | 1 | |
| Mehrere Geräte IDs | Ja | |

### Allgemeines
| Einstellung | Ausprägung | Kommentar |
| -------- | ------- | ------- |
| Aliases benutzen | Nein | |
| Die Adressen nicht auf 16 Bits ausrichten | Nein | |
| "Mehrere Register schreiben" nicht verwenden | Ja | |
| Nur "Write multiple registers" verwenden | Nein | |
| Datenabfrageintervall | 30000ms | |
| Wartezeit bis zum erneuten Verbinden | 60000ms | |
| Wartezeit Lesend | 15000ms | |
| Impluszeit | 1000ms | |
| Wartezeit | 500ms | |
| Max Leseanforderungslänge (Float) | 10 Register | |
| Max Leseanforderungslänge (Booleans) | 10 Register | |
| Leseintervall | 500ms | |
| Schreibintervall | 0ms | This could potentially replace the sleep(3000) in the javascript |
| Unveränderte Zustände aktualisieren | Nein |
| Adresse nicht in ID aufnehmen | Nein |
| Punkte in IDs erhalten | Nein |

## Holding Registers / TSV
There are several tsv files as there are different device types and possible optional registers.
The default slave ID is 2, you can have several devices in one instance, just add the registers with the according slave ID.
| Devices without humidity and CO2 sensors | M-WRG-II P / M-WRG-II E | meltem_default.tsv |
| Devices with humidity sensors | M-WRG-II P-F / M-WRG-II E-F | meltem_default_F.tsv |
| Devices without humidity and CO2 sensors | M-WRG-II P-FC / M-WRG-II E-FC| meltem_default_FC.tsv |
| Optional configuration parameters, only import the ones you really require (I had timeouts when using those, so better use the app to configure those) | all | meltem_optional_config.tsv |

## Control Script (Javascript)

A script to add some calculated measures, give display names for the current mode and add control states for mode and fan speed. The datapoints will be automatically created by the script in the path 0_userdata.0.meltem (can be configured if necessary) and relies on the names used in the tsv-files (can also be adjusted if you changed them).

Create a new script of type "javascript" in the javascript adapter and paste the code.

The script currently relies on a consecutive numbering starting with 2 (e.g. numberOfDevices=2 will check the datapoints modbus.0.holdingRegisters.2 and modbus.0.holdingRegisters.3). It  will currently not work if you have gaps (e.g. because you removed a device from the app/gateway or want to ignore it, let me know if that is a requirement).

The ventilation level datapoints (ventilationLevelSupplyAir and ventilationLevelExtractAir) will not immediately change the device state. Instead set those datapoints and set the mode control (modeControl) to either "balanced" (this uses the ventilationLevelSupplyAir for both fans) or "unbalanced" (will use the separate speeds).

The mode "Intensive Ventilation" is setting both fans to maximum level. Unfortunately the device doesn't handle setting it back to the previous state as the app or the button on the device does. Additionally the interval duration as configured in the app/device can also not be accessed via modbus so you need to configure it in the script (default is 10). Then the script will set the previous mode (if you restart iobroker or the script in the meantime, this will not happen!). As the states that are reported from the device are different from the ones the device requires to be set, there might be situations where this will not work. In my tests it worked all the time but I can't make sure that it will work 100% of the time. Be aware of that when using this mode!


