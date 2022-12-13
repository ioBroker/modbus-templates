# Modbus Templates

The ioBroker adapter ioBroker.modbus can connect to many devices that are on the market. But normally you need to manually add all the registers and fiel definitions based on the device specifications. This is a lot of work ...

## The Idea
What if only one user needs to make this work to collect all registers and fields and would share his results as an export TSV file and adds it here. Then other users can simply download it and use it directly. That would be cool, or?

## So, Let's start


## Repository structure

We are now just at the beginning, so we need to find the best way together.
We start the following:
* In the repository we have folders for "device categories" (We build then as we add devices when we find out that a new device do not match to extisting categories
* For each device we add some files to the respective folder
  1. **devicename.md**: AN md File with more information to the defice, the Full name, potential other compataible devices and specialsettings. Lets try to fnd a template structure together
  2. **devicename-TYPE.tsv**: this is the Exported TSV File with the register definitions for the device by relevant register type (if relevant)
    * discrete-inputs
    * discrete-outputs
    * input-register
    * holding-register
