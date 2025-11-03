// ===========================================================
//  SolarEdge Battery Daily Energy Decoder (uint64BE → Wh, korrekt)
// ===========================================================

const REG_DIS = "modbus.3.holdingRegisters.97719_Batt1_Export_Total";
const REG_CHA = "modbus.3.holdingRegisters.97723_Batt1_Import_Total";

const ST_DIS = "0_userdata.0.Power.Solar.Battery.Daily_Discharge_Wh";
const ST_CHA = "0_userdata.0.Power.Solar.Battery.Daily_Charge_Wh";

function ensureState(id) {
    if (!existsState(id))
        createState(id, 0, { type: "number", unit: "Wh", read: true, write: false });
}
ensureState(ST_DIS);
ensureState(ST_CHA);

// --- Decoder: nur Bytes 0–1, BE ---
function decodeWh(raw64) {
    const buf = Buffer.allocUnsafe(8);
    buf.writeBigUInt64BE(BigInt(raw64));
    const hex = [...buf].map(b => b.toString(16).padStart(2, "0")).join(" ");
    log(`🔍 Raw 8 B [BE]: ${hex}`);

    // nur erste 2 Bytes verwenden (BE)
    const value = (buf[0] << 8) + buf[1];
    return value; // Wh
}

function update() {
    try {
        const disRaw = getState(REG_DIS)?.val;
        const chaRaw = getState(REG_CHA)?.val;
        if (typeof disRaw !== "number" || typeof chaRaw !== "number") return;

        const disWh = decodeWh(disRaw);
        const chaWh = decodeWh(chaRaw);

        setState(ST_DIS, disWh, true);
        setState(ST_CHA, chaWh, true);

        log(`📊 Discharge: ${disWh} Wh | Charge: ${chaWh} Wh`);
    } catch (e) {
        log("Decode error: " + e);
    }
}

on({ id: [REG_DIS, REG_CHA], change: "any" }, update);
update();

log("✅ SolarEdge Battery Decoder aktiv (uint64BE → Bytes 0–1 BE → Wh)");

//Example Output in log
//Discharge raw: 12 d1 00 00 00 00 00 00 → 0x12D1 = 4817 Wh ✅
//Charge raw:    11 0c 00 00 00 00 00 00 → 0x110C = 4364 Wh ✅
