# M-TEC Energy Butler GEN3

Hybrid inverter (with battery) from M-TEC. The hardware is built by **Solinteg** and is also sold as
Solinteg Integ ONE GEN3, Wattsonic 3p AIO GEN3, Sunways STH GEN3, A-Tronix Hybridpower AX2 GEN3 and
SunEnergyBox SEB GEN3, so this template should work for those too.

> GEN2 devices use different addresses for battery and backup values (`40xxx`/`43xxx` instead of `30xxx`/`33xxx`). This template is for **GEN3 only**.

## Communication settings

All values are **holding registers** (function code 03, write 06/16). The device has no input registers, coils or discrete inputs, even though the addresses start with `1`/`3`.

### Modbus TCP (M-TEC WiFi/LAN dongle "espressif")

| parameter | value |
| --- | --- |
| Host | IP of the device called `espressif` in your router |
| Port | 502 (firmware before V27.52.4.0 used port 5743) |
| Framing | RTU over TCP |
| Device ID | 252 |

[MTECmqtt](https://github.com/croedel/MTECmqtt), an M-TEC specific tool, uses these values. evcc uses device ID 255 with plain Modbus TCP, which may apply to other Solinteg-based devices or setups.

### Modbus RTU (RS485)

Connect RS485 to pins 13 (B) and 14 (A) of the multi-function port. Use a shielded twisted pair (e.g. Cat7 STP). Slave firmware 3.04.01 or newer is required.

| parameter | value |
| --- | --- |
| Baudrate | 9600 baud |
| Data bits | 8 |
| Parity | none |
| Stop bits | 1 |
| Device ID | 247 (default, set under "General Settings") |

## ioBroker modbus adapter configuration

Settings refer to adapter version 9.x. Anything not listed can stay at its default.

### Tab "Connection"

| setting | via WiFi/LAN dongle | via RS485 |
| --- | --- | --- |
| TCP/Serial RTU | `RTU over TCP (Master)` | `Serial` |
| Mode | `Master` | `Master` |
| Slave address | IP of `espressif` | - |
| Port | `502` (`5743` on firmware < V27.52.4.0) | serial port of your RS485 adapter, e.g. `/dev/ttyUSB0` |
| Baud rate / Data bits / Stop bits / Parity | - | `9600` / `8` / `1` / `none` |
| Device ID | `252` (see note) | `247` |
| Multi device IDs | off | off |

**Note on device ID 252:** the adapter's admin UI only accepts device IDs 1-247. If it doesn't let you save 252, set it directly in the instance object.

Easiest way, on the ioBroker host's command line:

```
iobroker object set system.adapter.modbus.0 native.params.deviceId=252
iobroker restart modbus.0
```

Or in the admin: turn on expert mode (graduation cap icon in the toolbar of the **Objects** tab). Only then the `system` folder shows its contents. Open `system` → `adapter` → `modbus` → `0` (the object without a value, at the folder level), click the pencil icon, go to **Raw (experts only)**, and change `"deviceId"` under `native.params` to `252`. Save, then restart the instance.

Don't open the adapter's settings dialog and save afterwards: its validation could reset or refuse the value.

If `RTU over TCP` with ID 252 gets no answer, try `TCP` with device ID `255` (used by evcc). Device ID 255 has the same 247 limit in the admin UI.

### Tab "Settings"

| setting | value | why |
| --- | --- | --- |
| Use aliases | **off** | The default is **on**. The TSV uses the raw register numbers from the M-TEC/Solinteg documentation (e.g. `11000`, `33000`). With aliases on, the adapter expects holding registers from `40001` and the import won't map. |
| Do not align addresses to 16 bits | off | |
| Do not include address in ID | optional | on: `holdingRegisters.Battery_SOC`, off: `holdingRegisters.33000_Battery_SOC` |
| Do not use "Write multiple registers" | off | The inverter supports FC06 and FC16 |
| Max read request length (float) | `100` (default) | Reduce to e.g. `50` if you get timeouts or "Illegal data address" errors |
| Max address gap to combine | `10` (default) | |
| Round real to | `2` (default) | Use `3` if you want cell voltages with mV resolution |
| Data polling interval | `10000` ms | The default `1000` is too fast for the inverter. Don't go below `5000`. |
| Reconnect delay | `60000` ms (default) | |
| Read timeout | `5000` ms (default) | Use `10000` over RS485 or WiFi if reads time out |
| Read interval | `100` ms | The default is `0`. Pause between two read requests, gives the inverter time to answer. |

### Tab "Holding registers"

Import `holding-registers.tsv` here (import button in the table toolbar). Leave the other register tabs empty.

| file | content | use it if |
| --- | --- | --- |
| `holding-registers.tsv` | status, power, energy, battery values and the basic writable settings | always |
| `holding-registers-addon.tsv` | 8 extra registers: the [newer firmware only](#newer-firmware-only) registers and the EMS battery control set points (`50207`-`50210`, see [use case 6](#6-advanced-battery-power-control-by-your-own-ems)) | optional, on top of `holding-registers.tsv`, if your firmware supports them and you want to use use cases 3.1, 3.2 or 6 |

Check whether the import in your adapter version adds to or replaces the existing table before importing the addon file. If it replaces, add the rows manually or merge both files into one before importing.

If a register block stops updating after adding the addon registers, your firmware doesn't support them. Remove them again.

## Sign conventions

| register | positive | negative |
| --- | --- | --- |
| `11000` Grid_Power (and `10994`-`10998`) | feed-in to grid | purchase from grid |
| `30258` Battery_Power | discharging | charging |
| `11016` Inverter_AC_Power | inverter delivers power | inverter draws from grid |

The household consumption can be calculated as `Inverter_AC_Power - Grid_Power + Backup_Power`.

## Writable registers

The registers with `RW:` in their description can be written. Values are ioBroker state values, after the factor is applied.

| register | name | values |
| --- | --- | --- |
| `25100` | Grid_Injection_Limit_Switch | 0 = off, 1 = on |
| `25103` | Grid_Injection_Limit | feed-in limit in % of rated power |
| `50000` | Working_Mode | see table below |
| `50001` | UPS_Function_Switch | 0 = off, 1 = on |
| `50006` | Unbalanced_Output_Switch | 0 = off, 1 = on |
| `50007` | Import_Limit_Switch | 0 = off, 1 = on |
| `50009` | Import_Limit | max. grid import in kW |
| `52502` / `52504` | On-/OffGrid_SOC_Protection | 0 = off, 1 = on |
| `52503` / `52505` | On-/OffGrid_End_SOC | minimum SOC in % (5-100) |

Working mode (`50000`):

| value | mode |
| --- | --- |
| 257 | General mode (self consumption) |
| 258 | Economic mode |
| 259 | UPS mode |
| 512 | Off-grid mode |
| 769 | EMS AC power control |
| 770 | EMS general mode |
| 771 | EMS battery control |
| 772 | EMS off-grid mode |

The EMS set points (`50202`-`50211`) only take effect in the EMS modes. The battery control set points `50207`-`50210` are in `holding-registers-addon.tsv`, the others are not in the templates. See [use case 6](#6-advanced-battery-power-control-by-your-own-ems).

Grid protection parameters (`28000`-`28102`) and the safety code (`25000`) are deliberately not included. Changing them can violate your grid connection rules.

### Newer firmware only

These registers exist only on newer firmware. On older devices, reading them can make the whole register block fail, so they are only in `holding-registers-addon.tsv`, not in `holding-registers.tsv`:

| register | name | type | factor | unit |
| --- | --- | --- | --- | --- |
| `52506` | Charge_Cutoff_SOC (RW, 10-98) | uint16be | 0.1 | % |
| `52601` | Charge_Current_Limit (RW) | uint16be | 0.1 | A |
| `52603` | Discharge_Current_Limit (RW) | uint16be | 0.1 | A |
| `32007` | Battery_Rated_Capacity (BMS fw V27.52.3.0+) | uint32be | 1 | Wh |

## Use cases for writable registers

The examples use the state IDs the adapter creates with default settings (`modbus.0.holdingRegisters.<address>_<name>`). Write values with `ack = false`, which is what `setState(id, value)` does by default.

> Settings like working mode or SOC limits are probably stored in the inverter's non-volatile memory. Only write them when the value really changes (e.g. a few times a day), not on every script cycle.
> Test every use case while watching the inverter in the M-TEC app, and know how to switch back to General mode (`50000` = `257`).

### Helper: save and restore the previous state

The inverter does not fall back to its previous settings on its own (see [3.3](#33-no-automatic-fallback-resettopreviousstate-and-watchdog)). So every example below first saves the current values with `saveState()` and later restores exactly those values with `resetToPreviousState()`, instead of writing hard-coded "normal" values.

Put this helper in a **global script** (folder `global` in the JavaScript adapter), so all examples can use it:

```js
// ---- M-TEC helper: remember and restore register values ----
const MTEC = 'modbus.0.holdingRegisters.';
const MTEC_SNAP = '0_userdata.0.mtec.snapshot.';
const MTEC_MODE = '50000_Working_Mode';

// Save the current values of the given registers under a key.
// If a snapshot for this key already exists, it is kept: it holds the values
// from before the first change, not values set by the special mode.
async function saveState(key, registers) {
    const id = MTEC_SNAP + key;
    if (existsState(id) && getState(id).val) return;
    const snap = {};
    for (const reg of registers) {
        const st = getState(MTEC + reg);
        if (st && st.val !== null && st.val !== undefined) snap[reg] = st.val;
    }
    await createStateAsync(id, '', { type: 'string', read: true, write: true, name: `M-TEC snapshot ${key}` });
    await setStateAsync(id, JSON.stringify(snap), true);
    log(`M-TEC: saved ${key}: ${JSON.stringify(snap)}`);
}

// Write the saved values back and delete the snapshot.
// The working mode is restored first, so the inverter leaves an EMS mode
// before its set points change.
async function resetToPreviousState(key) {
    const id = MTEC_SNAP + key;
    if (!existsState(id) || !getState(id).val) return;
    const snap = JSON.parse(getState(id).val);
    const regs = Object.keys(snap).sort((a, b) => (b === MTEC_MODE) - (a === MTEC_MODE));
    for (const reg of regs) {
        setState(MTEC + reg, snap[reg]);
        await wait(500);
    }
    await setStateAsync(id, '', true);
    log(`M-TEC: restored ${key}: ${JSON.stringify(snap)}`);
}

// IDs of all snapshot states
function snapshotIds() {
    const ids = [];
    $(`state[id=${MTEC_SNAP}*]`).each(id => ids.push(id));
    return ids;
}

// Restore all open snapshots, e.g. after a crash or a script restart.
async function resetAllToPreviousState() {
    for (const id of snapshotIds()) {
        await resetToPreviousState(id.substring(MTEC_SNAP.length));
    }
}
```

The snapshots are stored in `0_userdata.0.mtec.snapshot.*`, so they survive a restart of ioBroker. A non-empty snapshot means "a special mode is active and has not been restored yet".

### 1. Zero feed-in at negative electricity prices

With a dynamic tariff (Tibber, aWATTar, ...) or the "Solarspitzengesetz", you may not want to feed in when the price is negative. Turn on the feed-in limit and set it to 0 %. PV then only covers the house and the battery.

| register | value |
| --- | --- |
| `25100` Grid_Injection_Limit_Switch | `1` |
| `25103` Grid_Injection_Limit | `0` (%) during negative prices |

```js
// price state from your tariff adapter, e.g. tibberlink
on({ id: 'tibberlink.0.Homes.xxx.CurrentPrice.total', change: 'ne' }, async obj => {
    if (obj.state.val < 0) {
        await saveState('feedin', ['25100_Grid_Injection_Limit_Switch', '25103_Grid_Injection_Limit']);
        setState(MTEC + '25100_Grid_Injection_Limit_Switch', 1);
        setState(MTEC + '25103_Grid_Injection_Limit', 0);
    } else {
        await resetToPreviousState('feedin'); // e.g. back to your fixed 60 % limit, or off
    }
});
```

The same registers cover a fixed feed-in limit, e.g. 60 % for subsidised systems. Because the previous values are restored, such a fixed limit is kept after the negative price period.

### 2. Keep a battery reserve for power outages

If the backup port is wired, a reserve keeps the house powered during a blackout. Raise the on-grid end SOC, e.g. in winter or when a storm warning comes in from the DWD adapter, and restore it afterwards.

| register | value |
| --- | --- |
| `52502` OnGrid_SOC_Protection | `1` |
| `52503` OnGrid_End_SOC | e.g. `60` (%) before a storm |
| `52504` / `52505` | off-grid floor, e.g. `1` / `10` (%), so the battery is not completely drained during the outage. Set it once, it does not need to change. |

```js
// storm warning level from the DWD adapter (adjust the ID to your warning state)
on({ id: 'dwd.0.warning.severity', change: 'ne' }, async obj => {
    if (obj.state.val >= 3) {
        await saveState('reserve', ['52502_OnGrid_SOC_Protection', '52503_OnGrid_End_SOC']);
        setState(MTEC + '52502_OnGrid_SOC_Protection', 1);
        setState(MTEC + '52503_OnGrid_End_SOC', 60);
    } else {
        await resetToPreviousState('reserve');
    }
});
```

### 3. Dynamic tariff: hold or force-charge the battery

evcc controls these inverters with just the working mode (`50000`). You can do the same from ioBroker:

| situation | `50000` Working_Mode | effect |
| --- | --- | --- |
| normal | `257` General | self consumption: battery charges from PV surplus and discharges to cover the house |
| hold battery | `258` Economic | the battery is not discharged, e.g. while the EV charges or prices are cheap so the stored energy is used later |
| charge battery | `259` UPS | the battery is charged, also from the grid, e.g. in the cheapest hours of the night |

```js
// switch modes by price, thresholds are examples
on({ id: 'tibberlink.0.Homes.xxx.CurrentPrice.total', change: 'ne' }, async obj => {
    const price = obj.state.val;
    if (price < 0.25) {
        // the snapshot is taken only once, so switching 259 -> 258 still restores the original mode
        await saveState('mode', [MTEC_MODE]);
        setState(MTEC + MTEC_MODE, price < 0.15 ? 259 : 258);
    } else {
        await resetToPreviousState('mode');
    }
});
```

What Economic and UPS mode do exactly depends on what you set in the M-TEC app (e.g. the UPS charge target). Check the behaviour on your system before automating it.

An alternative that doesn't change the mode: set `52503` OnGrid_End_SOC to the current SOC (with `saveState('hold', ['52503_OnGrid_End_SOC'])` before). The battery then stops discharging, but still charges from PV.

### 3.1 Limit battery charge power (e.g. to 1 kW)

Useful to spread charging over the day: the battery doesn't fill up by noon, and the PV peak at midday can still go into the battery instead of being cut off by a feed-in limit.

The inverter has no charge limit in watts that works in normal operation. It does have a **charge current limit in ampere**, which works in General mode, so self consumption keeps running. Convert watts to ampere with the battery voltage: `I = P / U_battery`.

These registers only exist on newer firmware (see [Newer firmware only](#newer-firmware-only)) and are included in `holding-registers-addon.tsv`:

| address | name | type | len | factor | unit | role |
| --- | --- | --- | --- | --- | --- | --- |
| `52601` | Charge_Current_Limit | uint16be | 1 | 0.1 | A | level |
| `52603` | Discharge_Current_Limit | uint16be | 1 | 0.1 | A | level |

```js
// limit battery charging to about 1 kW from 08:00 to 13:00, then restore the previous limit
const MAX_CHARGE_W = 1000;
let limitActive = false;

async function applyChargeLimit() {
    const u = getState(MTEC + '30254_Battery_Voltage').val;
    if (!u || u < 50) return; // no valid voltage
    const amps = Math.round((MAX_CHARGE_W / u) * 10) / 10;
    const current = getState(MTEC + '52601_Charge_Current_Limit').val;
    if (Math.abs(current - amps) >= 0.5) { // only write on real changes
        setState(MTEC + '52601_Charge_Current_Limit', amps);
    }
}

schedule('0 8 * * *', async () => {
    await saveState('chargelimit', ['52601_Charge_Current_Limit']);
    limitActive = true;
    await applyChargeLimit();
});
schedule('0 13 * * *', async () => {
    limitActive = false;
    await resetToPreviousState('chargelimit');
});
// the battery voltage changes with the SOC, so recalculate the current
on({ id: MTEC + '30254_Battery_Voltage', change: 'ne' }, () => {
    if (limitActive) applyChargeLimit();
});
```

`52603` works the same way for discharging, e.g. to keep the battery from emptying too fast at night.

M-TEC batteries are high voltage, so the current values are small: 1 kW at 400 V is only 2.5 A. Because of the 0.1 A steps, the result is approximate (± 40 W at 400 V).

### 3.2 Force battery charge with a fixed power (e.g. 2 kW)

For charging from the grid in cheap hours with a defined power, instead of the uncontrolled charging of UPS mode. This uses the EMS battery control mode and needs the registers from [use case 6](#6-advanced-battery-power-control-by-your-own-ems), which are in `holding-registers-addon.tsv`.

| register | value | meaning |
| --- | --- | --- |
| `50207` EMS_Battery_Power | `-2.0` | charge with 2 kW (negative = charge) |
| `50208` EMS_Max_Grid_Injection | `10` | feed-in limit, PV surplus can still go to the grid |
| `50209` EMS_Max_Grid_Purchase | `-10` | allow up to 10 kW purchase, so the 2 kW also come from the grid without PV |
| `50210` EMS_Output_Priority | `0` | PV first |
| `50000` Working_Mode | `771` | EMS battery control, write this **last** |

```js
// force charge with 2 kW between 02:00 and 05:00, then restore the previous mode and set points
const FORCE_REGS = [
    MTEC_MODE,
    '50207_EMS_Battery_Power',
    '50208_EMS_Max_Grid_Injection',
    '50209_EMS_Max_Grid_Purchase',
    '50210_EMS_Output_Priority',
];

schedule('0 2 * * *', async () => {
    await saveState('forcecharge', FORCE_REGS);
    setState(MTEC + '50207_EMS_Battery_Power', -2.0);
    setState(MTEC + '50208_EMS_Max_Grid_Injection', 10);
    setState(MTEC + '50209_EMS_Max_Grid_Purchase', -10);
    setState(MTEC + '50210_EMS_Output_Priority', 0);
    await wait(2000);
    setState(MTEC + MTEC_MODE, 771); // mode last
});
schedule('0 5 * * *', () => resetToPreviousState('forcecharge'));
// safety: stop force charging when the battery is full
on({ id: MTEC + '33000_Battery_SOC', change: 'ne' }, obj => {
    if (obj.state.val >= 95) resetToPreviousState('forcecharge'); // does nothing if no snapshot is open
});
```

Things to know about EMS battery control:
- The battery power is a **fixed set point**, not a limit. The battery does nothing else: it doesn't discharge to cover the house while the mode is active, and the house is supplied from the grid.
- **Test the sign with a small value first** (e.g. `-0.3`), see the notes in use case 6.
- **Force discharge** works the same way with a positive value (e.g. `50207 = 2.0`, `50208 = 3`), e.g. to sell stored energy at high prices.
- In EMS mode, `50207` with `50209 = 0` (no purchase) could also cap charging at 1 kW from PV only, but then the battery doesn't cover the house in the evening either. For 3.1, the current limit is the better choice.
- Don't combine 3 and 3.2 at the same time: both save and change `50000`. If both are active, whichever restores last wins.

### 3.3 No automatic fallback: resetToPreviousState and watchdog

Unlike SMA, the inverter has **no documented timeout** for working mode, EMS set points or current limits. They are settings, not commands: they stay active until something writes a new value, even if ioBroker is down for days. (evcc needs a watchdog for SMA, but not for this inverter. It writes the mode once and sets it back to `257` itself.)

The only timeout in the Solinteg documentation is for setups where an external EMS sends meter or BMS data to the inverter (`25104`-`25110`, `53500`-`53523`). That doesn't apply to normal setups.

So the scripts take care of the fallback themselves, with the [helper](#helper-save-and-restore-the-previous-state) above. Add this to the script that uses the use cases:

```js
// 1. script start: restore anything left over from a crash, a reboot or a script restart
resetAllToPreviousState();

// 2. script is stopped or restarted
onStop(() => { resetAllToPreviousState(); }, 5000);

// 3. maximum duration for any special state: 6 hours (longer than the longest planned window)
const MAX_HOURS = 6;
schedule('*/10 * * * *', async () => {
    for (const id of snapshotIds()) {
        const st = getState(id);
        if (st.val && Date.now() - st.ts > MAX_HOURS * 3600 * 1000) {
            log(`M-TEC: ${id} active for more than ${MAX_HOURS} h, restoring`, 'warn');
            await resetToPreviousState(id.substring(MTEC_SNAP.length));
        }
    }
});
```

Because the snapshots are stored in states, step 1 also handles a crash of ioBroker or the host: as soon as ioBroker is running again, the previous settings are restored. Until then, the last setting stays active. Therefore:
- Prefer settings that are harmless if they stay active: a current limit (3.1) or a higher end SOC (2) only cost some self consumption, while a forgotten force-charge (3.2) keeps buying from the grid.
- Check the working mode in the M-TEC app after ioBroker problems.
- Don't change the registers in the M-TEC app while a snapshot is open: restoring overwrites them with the saved values.

### 4. Peak shaving: limit grid import

Limits how much power is drawn from the grid, e.g. for a grid-fee model that charges for peak power, or to protect the main fuse. The battery covers what's above the limit, as long as it has charge.

| register | value |
| --- | --- |
| `50007` Import_Limit_Switch | `1` |
| `50009` Import_Limit | max. import in kW, e.g. `4.0` |

### 5. Unbalanced output

`50006` Unbalanced_Output_Switch = `1` lets the inverter deliver different power per phase, so it can cover a single-phase load (e.g. a single-phase EV charger) on its own phase. With `0`, all phases get the same power. Whether this is allowed depends on your grid operator.

### 6. Advanced: battery power control by your own EMS

For full control (e.g. "charge with exactly 2 kW now"), the inverter has an EMS battery control mode. These registers are only in `holding-registers-addon.tsv` (not in `holding-registers.tsv`):

| address | name | type | factor | unit | meaning |
| --- | --- | --- | --- | --- | --- |
| `50207` | EMS_Battery_Power | int16be | 0.01 | kW | battery set point: **negative = charge, positive = discharge** |
| `50208` | EMS_Max_Grid_Injection | int16be | 0.01 | kW | upper limit of inverter AC power (max. feed-in) |
| `50209` | EMS_Max_Grid_Purchase | int16be | 0.01 | kW | lower limit of inverter AC power, negative (e.g. `-0.5` = max. 500 W purchase) |
| `50210` | EMS_Output_Priority | uint16be | 1 | | `0` = PV first, `1` = battery first |

Then set `50000` Working_Mode to `771` (EMS battery control). Examples from the Solinteg documentation:

- **Charge 1 kW, buy at most 500 W from the grid:** `50207 = -1.0`, `50208 = 10`, `50209 = -0.5`, `50210 = 0`. With no PV, the battery charges with 500 W. With 2 kW PV, it charges with 1 kW and 1 kW goes to the grid.
- **Force discharge 1 kW, feed in at most 2 kW:** `50207 = 1.0`, `50208 = 2`, `50209 = -10`, `50210 = 0`.

Notes:
- The sign of `50207` follows the official Solinteg documentation. [solinteg-modbus](https://github.com/balloobbot/solinteg-modbus) documents it the other way round, so check with a small value first.
- Factor and unit (0.01 kW, i.e. 10 W steps) come from the Solinteg register table and solinteg-modbus. The examples in the Solinteg documentation are written in W.
- The inverter keeps the last set point. If ioBroker or your script stops, the battery keeps charging or discharging as last commanded. Switch back to `257` when your script ends, and consider a watchdog script.
- `769` (EMS AC power control, registers `50202`-`50206`) sets the total inverter AC power directly. `772` (EMS off-grid, register `50211`) sets the PV power in off-grid mode. Both are for special setups only.

## Fault bit fields

`10110` Operation_Flags: bit0 work mode abnormal, bit1 emergency stop, bit2 DC abnormal, bit3 mains abnormal, bit4 off-grid disabled, bit5 battery abnormal, bit6 command stop, bit7 SOC low and no PV, bit8 slave comm error, bit9 meter abnormal, bit14 off-grid, bit16 command power limit, bit17 over-frequency derating, bit18 over-temperature derating, bit21 export power limit, bit25 EMS command limit, bit31 PV power limit.

`10112` Fault_Flag1: bit0 mains lost, bit1 grid voltage, bit2 grid frequency, bit3 DCI, bit4 ISO over limitation, bit5 GFCI, bit6 PV over voltage, bit7 bus voltage, bit8 inverter over temperature.

`10114` Fault_Flag2: bit1 SPI, bit2 EEPROM, bit3 GFCI device, bit4 AC transducer, bit5 relay check failed, bit6 internal fan, bit7 external fan.

`10120` Fault_Flag3: bit0 bus hardware, bit1 PV power low, bit2 battery voltage, bit3 backup voltage, bit4 bus voltage low, bit5 system hardware, bit6 backup over power, bit7 inverter over voltage, bit8 inverter over frequency, bit9 inverter over current, bit10 phase order error.

## Sources

- M-TEC Energy Butler RTU Protocol GEN2 + GEN3 V1.0 ([ioBroker forum](https://forum.iobroker.net/topic/64236/m-tec-energy-butler))
- Solinteg Hybrid Inverter Modbus Register Table V00.03 ([bern77/openhab-solinteg-config](https://github.com/bern77/openhab-solinteg-config))
- evcc template [`solinteg-gen3.yaml`](https://github.com/evcc-io/evcc/blob/master/templates/definition/meter/solinteg-gen3.yaml)
- [balloobbot/solinteg-modbus](https://github.com/balloobbot/solinteg-modbus), derived from [homeassistant-solax-modbus](https://github.com/wills106/homeassistant-solax-modbus) `plugin_solinteg.py`
- [croedel/MTECmqtt](https://github.com/croedel/MTECmqtt)
