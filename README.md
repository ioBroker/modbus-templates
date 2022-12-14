# Modbus Templates

The ioBroker adapter ioBroker.modbus can connect to many devices that are on the market. But normally you need to manually add all the registers and fiel definitions based on the device specifications. This is a lot of work ...

## The Idea
What if only one user needs to make this work to collect all registers and fields and would share his results as an export TSV file and adds it here. Then other users can simply download it and use it directly. That would be cool, or?

## So, Let's start


## Repository structure

We are now just at the beginning, so we need to find the best way together.
We start the following:
* In the repository we have folders for "device categories" (We build then as we add devices when we find out that a new device do not match to existing categories
* For each device we add another folder with the device name
* In there we have some files
  1. **device.md**: AN md File with more information to the device, the Full name, potential other compatible devices and special settings. Let's try to fnd a template structure together
  2. **TYPE.tsv**: this is the Exported TSV File with the register definitions for the device by relevant register type (if relevant)
    * discrete-inputs.tsv
    * discrete-outputs.tsv
    * input-register.tsv
    * holding-register.tsv
  3. If relevant we could also have a settings.jpg or such

## How to get my exports in here?
In fact there are two options

### Create a Pull request
You can use the GitHub Web editor to create a fork, add folders and files and provide a Pull Request

### Create an Issue with all Files attached
If you find this whole GitHub stuff too complicated then create an issue cin this repository and add all infos and tsv Files as attachments (please not inline as text!) there. Then we take it over
