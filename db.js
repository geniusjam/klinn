const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

const init = async () => {
    const db = await sqlite.open({
        filename: "data.db",
        driver: sqlite3.Database,
    });

    await db.exec("CREATE TABLE IF NOT EXISTS accounts (name TEXT, id TEXT, password TEXT);");
    await db.exec("CREATE TABLE IF NOT EXISTS patients (id TEXT PRIMARY KEY, name TEXT, lastname TEXT, gender INTEGER, createdBy TEXT, photo TEXT,"
        + "birthdate INTEGER, createdAt TEXT, waitedFor INTEGER, isWaiting INTEGER, whereis INTEGER);");
    await db.exec("CREATE TABLE IF NOT EXISTS visits (id INTEGER, patient TEXT, date TEXT, createdBy TEXT, "
        + "complaint TEXT, complaintNotes TEXT, vitalsTemp REAL, vitalsWeight INTEGER, vitalsHeight INTEGER, vitalsHeartRate INTEGER, vitalsBPA INTEGER, vitalsBPB INTEGER, vitalsO2 INTEGER, vitalsRespRate INTEGER, "
        + "bgResults TEXT, bgDate TEXT, bgNotes TEXT, examDoctor TEXT, examNotes TEXT, diagnosis TEXT, diagnosisNotes TEXT);");
    await db.exec("CREATE TABLE IF NOT EXISTS pharmacy (id INTEGER, patient TEXT, visit INTEGER, drug TEXT, dispense INTEGER, dose TEXT, "
        + "countedBy TEXT, countedAt TEXT, filledBy TEXT, filledAt TEXT);");

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
        await db.run("INSERT INTO patients(id,name,lastname,gender,createdBy,birthdate,createdAt) VALUES (?,?,?,?,?,?,?)",
            id, name, lastname, gender, createdBy, birthdate, createdAt);

        return { id, name, lastname, gender, createdBy, birthdate, createdAt }; // partial patient
    }

    async function getPatientById(id) {
        return await db.get("SELECT * FROM patients WHERE id = ?", id);
    }

    async function createVisit(id, patient, createdBy, createdAt) {
        if (!(await db.get("SELECT name FROM patients WHERE id = ?", patient))) throw "No such patient.";

        await db.run("INSERT INTO visits(id,patient,date,createdBy) VALUES (?,?,?,?);", id, patient, createdAt, createdBy);

        return { id, date: createdAt, patient, createdBy }; // partial visit
    }

    async function createMedication(id, patient, visit) {
        await db.run("INSERT INTO pharmacy(id,patient,visit) VALUES (?,?,?);", id, patient, visit);

        return { id, patient, visit };
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

    async function getPatientsByName(name, a, b) {
        return await db.all("SELECT * FROM patients WHERE firstname + \" \" + lastname LIKE ? ORDER BY createdAt LIMIT ? OFFSET ?", name, b-a, a);
    }

    async function updateMedication(id, patient, visit, field, value) {
        await db.run(`UPDATE pharmacy SET ${field} = ? WHERE id = ? AND patient = ? AND visit = ?`, value, id, patient, visit);
    }

    async function updateVisit(patient, visit, field, value) {
        await db.run(`UPDATE visits SET ${field} = ? WHERE id = ? AND patient = ?`, value, visit, patient);
    }

    async function updatePatient(id, name, lastname, gender, birthdate) {
        await db.run(`UPDATE patients SET name = ?, lastname = ?, gender = ?, birthdate = ? WHERE id = ?`, name, lastname, gender, birthdate, id);
    }

    async function deleteVisit(id, patient) {
        await db.run("DELETE FROM visits WHERE patient = ? AND id = ?", patient, id);
        await db.run("DELETE FROM pharmacy WHERE patient = ? AND visit = ?", patient, id);
    }

    async function deletePatient(patient) {
        await db.run("DELETE FROM patients WHERE id = ?", patient);
        await db.run("DELETE FROM visits WHERE patient = ?", patient);
        await db.run("DELETE FROM pharmacy WHERE patient = ?", patient);
    }

    async function deleteMedication(id, patient, visit) {
        await db.run("DELETE FROM pharmacy WHERE patient = ? AND visit = ? AND id = ?", patient, visit, id);
    }


    return { db, getAccountById, getAccountsSafe, createPatient, getPatientById, createVisit,
        getVisitsOf, getPatients, getPatientsByName, getAllPatients, getAllVisits, updateVisit,
        updatePatient, deletePatient, getAllPharmacy, createMedication, updateMedication, deleteMedication,
        deleteVisit };
};

module.exports = init;