const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const init = async () => {
    const db = await sqlite.open({
        filename: "data.db",
        driver: sqlite3.Database,
    });

    await db.exec("CREATE TABLE IF NOT EXISTS accounts (name TEXT, id TEXT, password TEXT);");
    await db.exec("CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, name TEXT, lastname TEXT, gender INTEGER, createdBy TEXT, photo TEXT, lastEditedAt INTEGER, "
        + "birthdate INTEGER, createdAt INTEGER, waitedFor INTEGER, isWaiting INTEGER, whereis INTEGER);");
    await db.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER, patient TEXT, date INTEGER, createdBy TEXT, lastEditedAt INTEGER, "
        + "complaint TEXT, complaintNotes TEXT, vitalsTemp REAL, vitalsWeight INTEGER, vitalsHeight INTEGER, vitalsHeartRate INTEGER, vitalsBPA INTEGER, vitalsBPB INTEGER, vitalsO2 INTEGER, vitalsRespRate INTEGER, "
        + "bgResults TEXT, bgDate TEXT, bgNotes TEXT, examDoctor TEXT, examNotes TEXT, diagnosis TEXT, diagnosisNotes TEXT, "
        + "referredToHospital INTEGER);");
    await db.exec("CREATE TABLE IF NOT EXISTS pharmacy (id INTEGER, patient TEXT, visit INTEGER, drug TEXT, dispense INTEGER, dose TEXT, lastEditedAt INTEGER, createdAt INTEGER, "
        + "countedBy TEXT, countedAt TEXT, filledBy TEXT, filledAt TEXT);");
    // history
    await db.exec("CREATE TABLE IF NOT EXISTS history_medical (id INTEGER, patient TEXT, disease TEXT, date INTEGER, treatment TEXT)");
    await db.exec("CREATE TABLE IF NOT EXISTS history_surgical (id INTEGER, patient TEXT, surgery TEXT, date INTEGER, place TEXT, complication TEXT)");
    await db.exec("CREATE TABLE IF NOT EXISTS history_traumatic (id INTEGER, patient TEXT, part TEXT, surgery TEXT, date INTEGER, complication TEXT)");
    await db.exec("CREATE TABLE IF NOT EXISTS history_allergic (id INTEGER, patient TEXT, name TEXT)");
    await db.exec("CREATE TABLE IF NOT EXISTS history_hereditary (id INTEGER, patient TEXT, relative TEXT, disease TEXT)");
    
    // addColumn method for those databases which are not being created for the first time
    // but don't have the required columns.
    async function addColumn(table, name, type) {
        const cols = await db.all(`PRAGMA table_info(${table})`);
        if (cols.find(c => c.name === name)) return;
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${type};`);
    }

    await addColumn('patients', 'lastEditedAt', 'INTEGER');
    await addColumn('visits', 'lastEditedAt', 'INTEGER');
    await addColumn('pharmacy', 'lastEditedAt', 'INTEGER');
    await addColumn('pharmacy', 'createdAt', 'INTEGER');

    await addColumn('visits', 'referredToHospital', 'INTEGER'); // boolean // whether the patient was referred to the hospital

    // TODO: make accounts dynamic
    const accounts = await db.all("SELECT * FROM accounts");

    if (accounts.length < 1) {
        console.warn("No accounts. Using default accounts.");
        accounts.push({ id: '2001', name: 'Medic 1', password: '1402' });
        accounts.push({ id: '2002', name: 'Medic 2', password: '9876' });
        accounts.push({ id: '2003', name: 'Medic 3', password: '6774' });
    }

    async function getAccountById(id) {
        return accounts.find(a => a.id === id);
    }

    async function getAccountsSafe() {
        return accounts.map(acc => ({ name: acc.name, id: acc.id }));
    }

    async function createPatient(id, name, lastname, gender, createdBy, birthdate, createdAt) {
        await db.run("INSERT INTO patients(id,name,lastname,gender,createdBy,birthdate,createdAt,lastEditedAt) VALUES (?,?,?,?,?,?,?,?)",
            id, name, lastname, gender, createdBy, birthdate, createdAt, createdAt);

        return { id, name, lastname, gender, createdBy, birthdate, createdAt }; // partial patient
    }

    async function createVisit(id, patient, createdBy, createdAt) {
        if (!(await db.get("SELECT name FROM patients WHERE id = ?", patient))) throw "No such patient.";

        await db.run("INSERT INTO visits(id,patient,date,createdBy,lastEditedAt) VALUES (?,?,?,?,?);", id, patient, createdAt, createdBy, createdAt);

        return { id, date: createdAt, patient, createdBy }; // partial visit
    }

    async function createMedication(id, patient, visit, createdAt) {
        await db.run("INSERT INTO pharmacy(id,patient,visit,createdAt) VALUES (?,?,?,?);", id, patient, visit, createdAt);

        return { id, patient, visit, createdAt };
    }

    /** @param type should never be controlled by the user */
    async function createHistory(type, id, patient) {
        await db.run(`INSERT INTO history_${type}(id,patient) VALUES (?,?)`, id, patient);
    }

    async function getPatientById(id) {
        return await db.get("SELECT * FROM patients WHERE id = ?", id);
    }

    async function getVisitsOf(patient) {
        return await db.all("SELECT * FROM visits WHERE patient = ?", patient); // TODO: Limit db.all?
    }

    async function getPatients(a, b) {
        return await db.all("SELECT * FROM patients ORDER BY createdAt LIMIT ? OFFSET ?", b-a, a);
    }

    async function getAllPatients() {
        return await db.all("SELECT * FROM patients");
    }

    async function getAllVisits() {
        return await db.all("SELECT * FROM visits");
    }

    async function getAllPharmacy() {
        return await db.all("SELECT * FROM pharmacy");
    }

    async function getAllHistory() {
        return {
            medical: await db.all("SELECT * FROM history_medical"),
            surgical: await db.all("SELECT * FROM history_surgical"),
            traumatic: await db.all("SELECT * FROM history_traumatic"),
            allergic: await db.all("SELECT * FROM history_allergic"),
            hereditary: await db.all("SELECT * FROM history_hereditary"),
        };
    }

    async function getPatientsByName(name, a, b) {
        return await db.all("SELECT * FROM patients WHERE firstname + \" \" + lastname LIKE ? ORDER BY createdAt LIMIT ? OFFSET ?", name, b-a, a);
    }

    async function updateHistory(type, id, patient, field, value) {
        await db.run(`UPDATE history_${type} SET ${field} = ? WHERE id = ? AND patient = ?`, value, id, patient);
    }

    async function updateMedication(id, patient, visit, field, value) {
        await db.run(`UPDATE pharmacy SET ${field} = ? WHERE id = ? AND patient = ? AND visit = ?`, value, id, patient, visit);
    }

    async function updateVisit(patient, visit, field, value) {
        await db.run(`UPDATE visits SET ${field} = ? WHERE id = ? AND patient = ?`, value, visit, patient);
    }

    async function updatePatient(id, name, lastname, gender, birthdate, isWaiting, whereis) {
        await db.run(`UPDATE patients SET name = ?, lastname = ?, gender = ?, birthdate = ?, isWaiting = ?, whereis = ? WHERE id = ?`, name, lastname, gender, birthdate, isWaiting, whereis, id);
    }

    async function deleteVisit(id, patient) {
        await db.run("DELETE FROM visits WHERE patient = ? AND id = ?", patient, id);
        await db.run("DELETE FROM pharmacy WHERE patient = ? AND visit = ?", patient, id);
    }

    async function deletePatient(patient) {
        await db.run("DELETE FROM patients WHERE id = ?", patient);
        await db.run("DELETE FROM visits WHERE patient = ?", patient);
        await db.run("DELETE FROM pharmacy WHERE patient = ?", patient);

        await db.run("DELETE FROM history_medical WHERE patient = ?", patient);
        await db.run("DELETE FROM history_surgical WHERE patient = ?", patient);
        await db.run("DELETE FROM history_traumatic WHERE patient = ?", patient);
        await db.run("DELETE FROM history_allergic WHERE patient = ?", patient);
        await db.run("DELETE FROM history_hereditary WHERE patient = ?", patient);
    }

    async function deleteMedication(id, patient, visit) {
        await db.run("DELETE FROM pharmacy WHERE patient = ? AND visit = ? AND id = ?", patient, visit, id);
    }

    async function deleteHistory(type, id, patient) { // delete history item
        await db.run(`DELETE FROM history_${type} WHERE id = ? AND patient = ?`, id, patient)
    }


    return { db, getAccountById, getAccountsSafe, createPatient, getPatientById, createVisit,
        getVisitsOf, getPatients, getPatientsByName, getAllPatients, getAllVisits, updateVisit,
        updatePatient, deletePatient, getAllPharmacy, createMedication, updateMedication, deleteMedication,
        deleteVisit, createHistory, getAllHistory, updateHistory, deleteHistory };
};

module.exports = init;