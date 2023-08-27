const express = require('express');
const path = require("path");
const app = express();
const Database = require("./db");
const Storage = require("./storage");
let db, storage;
/** @type {Storage.Drug[]} */
let inventory;
app.use(express.static("public/"));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

console.log("The address is " + getIPAddress() + ":1402");
const server = app.listen({ port: 1402, ip: getIPAddress() }, async () => {
    console.log("Server is ready.");
    db = await Database();
    storage = await Storage.init();
    inventory = (await storage.getAllInventory()).map(w => new Storage.Drug(w));
    console.log("Inventory ready.");
});

const DRUG_REGEXP = /^(.+) \((.*)\) \((.*)\)$/;

/** Find drug in inventory */
function findDrug(match) {
    if (!match) return null;
    return inventory.find(item => item.name === match[1] && item.dosage === match[2] &&
        item.presentation === match[3]) || null;
}

const { Server } = require("socket.io");
const io = new Server(server);

const sockets = [];
const subscriptions = {};

// TODO: find a better authorization method?
io.on("connection", async socket => {
    let account = null;
    let subs = [];

    socket.emit("info accounts", await db.getAccountsSafe());

    socket.on("log in", async data => {
        if (!data || !data.id || !data.password || account) return;
        const acc = await db.getAccountById(data.id);
        if (!acc) return;
        if (acc.password !== data.password) return socket.emit("wrong password");
        socket.emit("welcome", { diagnoses: await db.getAllDiagnoses(), medications: inventory.map(i => `${i.name} (${i.dosage}) (${i.presentation})`), visits: await db.getAllVisits(), patients: await db.getAllPatients(), pharmacy: await db.getAllPharmacy(), history: await db.getAllHistory() }); // TODO: mode for 0-50?
        account = acc;
        sockets.push(socket);
        sockets.forEach(s => s.emit("online update", sockets.length-1));
    });

    socket.on("new patient", async data => {
        if (!account || !data || !data.name || !data.lastname || (typeof data.gender !== "number") || !data.birthdate || !data.id || !data.createdAt) return;
        // TODO: check for types
        const patient = await db.createPatient(data.id, data.name, data.lastname, data.gender, account.id, data.birthdate, data.createdAt);
        sockets.forEach(sock => sock.emit("new patient", patient)); // partial patient

        // TODO: find workaround for when two sockets create patients with the same id while they were offline.
    });

    socket.on("new visit", async data => {
        if (!account || !data || !data.id || !data.patient || !data.createdAt) return;
        // might error if there is not such patient. in which case, there is nothing to worry
        // because the function will not continue the execution.
        // TODO: proper error handling?
        // TODO: type checking user controlled input
        const visit = await db.createVisit(data.id, data.patient, account.id, data.createdAt);

        // TODO: enable this section for another mode
        // new visit to subscribers
        // const s = "patient " + data;
        // if (subscriptions[s]) {
        //     // note: this is a partial visit, the client has to figure out the visit id itself
        //     subscriptions[s].forEach(sock => sock.emit("new visit", visit));
        // }

        // instead, we're gonna emit to all sockets.
        sockets.forEach(sock => sock.emit("new visit", visit)); // partial visit
    });

    // TODO: mode for this event
    socket.on("patient", async data => {
        // we expect an id
        if (!account || !data || typeof data !== "string") return;

        const patient = await db.getPatientById(data);
        if (!patient) return; // can't find such patient

        patient.visits = await db.getVisitsOf(data);
        socket.emit("info patient", patient);

        // subscribe
        const s = "patient " + data;
        if (!subscriptions[s]) subscriptions[s] = [];
        subscriptions[s].push(socket);
        subs.push(s);
    });

    // TODO: mode for this event
    socket.on("unsubscribe patient", data => {
        // we expect an id
        if (!account || !data || typeof data !== "string") return;

        // unsubscribe
        const s = "patient " + data;
        subs.splice(subs.findIndex(q => q === s), 1);
        if (subscriptions[s]) {
            subscriptions[s].splice(subscriptions[s].findIndex(sock => sock.id === socket.id), 1);
            if (subscriptions[s].length < 1) delete subscriptions[s];
        }
    });

    // TODO: mode for this event
    socket.on("search", async data => {
        if (!account || !data || !data.page || !data.name || typeof data.page !== "number" || typeof data.name !== "string") return;
        
        const N = 50;
        socket.emit("search result", { query: data.name, results: await db.getPatientsByName(data.name, data.page*N-N, data.page*N) });
    });

    socket.on("new medication", async data => {
        if (!account || !data || typeof data.id !== "number" || !data.visit || !data.patient || !data.createdAt) return; // TODO: type checking

        const med = await db.createMedication(data.id, data.patient, data.visit, data.createdAt);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("new medication", med)); // partial
    });

    socket.on("new diagnosis", async data => {
        if (!account || !data || typeof data.id !== "number" || !data.visit || !data.patient) return; // TODO: type checks

        await db.createDiagnosis(data.id, data.patient, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("new diagnosis", data)); // TODO: data sanitization
    });

    socket.on("new history", async data => {
        if (!account || !data || !data.type || !data.id || !data.patient) return;
        if (!["medical", "surgical", "traumatic", "allergic", "hereditary"].includes(data.type)) return;
        
        const { type, id, patient } = data;
        await db.createHistory(type, id, patient);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("new history", { type, id, patient }));
    });

    socket.on("upd history", async data => {
        if (!account || !data || !data.type || !data.id || !data.patient || !data.field) return;
        if (!["medical", "surgical", "traumatic", "allergic", "hereditary"].includes(data.type)) return;
        // TODO: checks for field and value for security

        const { type, id, patient, field, value } = data;
        await db.updateHistory(type, id, patient, field, value);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd history", { type, id, patient, field, value }));
    });

    socket.on("upd diagnosis", async data => {
        if (!account || !data || typeof data.patient !== "string" || typeof data.visit !== "number" || typeof data.id !== "number"
            || typeof data.field !== "string" || typeof data.value === "undefined") return;
        // TODO: checks for data.field and type checking for data.value

        await db.updateDiagnosis(data.id, data.patient, data.visit, data.field, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd diagnosis", data)); // TODO: data sanitization
    });

    socket.on("upd medication", async data => {
        // expect patient, visit, field, value
        if (!account || !data || !data.patient || typeof data.visit !== "number" || typeof data.id !== "number" || !data.field || typeof data.value === "undefined") return;
        // TODO: type checking
        // TODO: check the field 

        // get the previous version of the medication
        // for use in the storage section later
        const old = await db.getMedication(data.id, data.patient, data.visit);
        if (!old.drug) old.drug = "";
        if (!old.dispense) old.dispense = 0;


        // STORAGE START
        const field = data.field; // alias
        const res = await (async () => {
            if (field !== "drug" && field !== "dispense") return true; // the field either has to be 'drug' or 'dispense'
            const logSuffix = `Patient, visit and medication id: ${data.patient}#${data.visit}#${data.id} Account: ${account.name} (${account.id})`;
            const oldmatch = findDrug(old.drug.match(DRUG_REGEXP));
            if (field === "dispense") {
                if (old.dispense === data.value) return false; // there was no change
                if (!oldmatch) return true; // could not find drug :(
                const medSuffix = `Medication: ${oldmatch.name} (${oldmatch.dosage}) (${oldmatch.presentation}).`;
                if (old.dispense > data.value) {
                    // more for the inventory!!
                    // add to inventory (old.dispense - data.value)
                    await storage.modifyDispensible(oldmatch, "+", old.dispense - data.value, {
                        type: "DISP_OGN", // dispense, old greater than new
                        description: `Dispense was changed with a smaller value. Adding more to the storage. ${medSuffix} ${logSuffix}`
                    });
                    inventory.find(i => i.name === oldmatch.name && i.dosage === oldmatch.dosage && i.presentation === oldmatch.presentation)
                        .dispensible += old.dispense - data.value;
                } else {
                    // less for the inventory :(
                    // bound check!!
                    const toSubtract = data.value - old.dispense;
                    if (oldmatch.dispensible < toSubtract) {
                        // oops. this is where things get a little tense.
                        socket.emit("dispense complaint", { ...data, value: old.dispense, inventory: oldmatch.dispensible }); // TODO: a better handling of "data"?
                        return false;
                    }
                    // subtract from inventory (data.value - old.dispense)
                    await storage.modifyDispensible(oldmatch, "-", data.value - old.dispense, {
                        type: "DISP_NGO", // dispense, new greater than old
                        description: `Dispense was changed with a bigger value. Subtracting from storage. ${medSuffix} ${logSuffix}`
                    });
                    inventory.find(i => i.name === oldmatch.name && i.dosage === oldmatch.dosage && i.presentation === oldmatch.presentation)
                        .dispensible -= data.value - old.dispense;
                }
            } else {
                if (oldmatch) {
                    // add (old.dispense) to oldmatch!!
                    const medSuffix = `Medication: ${oldmatch.name} (${oldmatch.dosage}) (${oldmatch.presentation}).`;
                    await storage.modifyDispensible(oldmatch, "+", old.dispense, {
                        type: "DRUG_OLD", // drug, subtract from old
                        description: `The drug name was changed from a recognizable drug. Adding back to the storage. ${medSuffix} ${logSuffix}`
                    });
                    inventory.find(i => i.name === oldmatch.name && i.dosage === oldmatch.dosage && i.presentation === oldmatch.presentation)
                        .dispensible += old.dispense;
                }
                const newmatch = findDrug(data.value.match(DRUG_REGEXP));
                if (!newmatch) return true; // no match :(
                // bound check!!
                if (newmatch.dispensible < old.dispense) {
                    socket.emit("drug complaint", { ...data, value: old.drug, inventory: oldmatch.dispensible }); // TODO: a better handling of "data"?
                    return false;
                }
                // remove (old.dispense) from newmatch
                const medSuffix = `Medication: ${newmatch.name} (${newmatch.dosage}) (${newmatch.presentation}).`;
                await storage.modifyDispensible(newmatch, "-", old.dispense, {
                    type: "DRUG_NEW", // drug, add to new
                    description: `The new drug is recognizable. Subtracting from storage. ${medSuffix} ${logSuffix}`
                });
                inventory.find(i => i.name === newmatch.name && i.dosage === newmatch.dosage && i.presentation === newmatch.presentation)
                    .dispensible -= old.dispense;
            }

            return true;
        })();

        if (res) { // this update was verified by the storage procedures.
            // change db
            await db.updateMedication(data.id, data.patient, data.visit, data.field, data.value);

            // send update to subscribers
            sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd medication", data)); // TODO: some kind of data sanitization for "data"?
        }
        // STORAGE END
    });

    socket.on("upd visit", async data => {
        // expect patient, visit, field, value
        if (!account || !data || !data.patient || typeof data.visit !== "number" || !data.field || typeof data.value === "undefined") return;
        // TODO: type checking
        // TODO: check the field 

        // change db
        await db.updateVisit(data.patient, data.visit, data.field, data.value);

        // send update to subscribers
        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd visit", data)) // TODO: some kind of data sanitization for "data"?
    });

    socket.on("upd patient", async data => {
        if (!account || !data || !data.id || typeof data.name !== "string" || typeof data.lastname !== "string" || typeof data.gender !== "number"
            || typeof data.birthdate !== "number") return;
        if (!data.isWaiting) data.isWaiting = 0;
        if (!data.whereis) data.whereis = 0;
        // TODO: type checking for data.id

        await db.updatePatient(data.id, data.name, data.lastname, data.gender, data.birthdate, data.isWaiting, data.whereis);

        // send update to subscribers
        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd patient", data)); // TODO: some kind of data sanitization for "data"?
    });

    socket.on("upd patient partial", async data => {
        if (!account || !data || !data.id || typeof data.field !== "string" || typeof data.value === "undefined") return;
        // TODO: type checking for data.id

        await db.updatePatientPartial(data.id, data.field, data.value);

        // send update to subscribers
        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd patient partial", data)); // TODO: some kind of data sanitization for "data"?
    });

    socket.on("delete patient", async patient => {
        if (!account || typeof patient !== "string") return;
        await db.deletePatient(patient);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete patient", patient));
    });

    socket.on("delete visit", async data => {
        if (!account || !data || typeof data.patient !== "string" || typeof data.id !== "number") return;
        await db.deleteVisit(data.id, data.patient);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete visit", { id: data.id, patient: data.patient }));
    });

    socket.on("delete medication", async data => {
        if (!account || !data || typeof data.patient !== "string" || typeof data.visit !== "number" || typeof data.id !== "number") return;

        // get the medication for storage purposes
        const old = await db.getMedication(data.id, data.patient, data.visit);
        if (!old.drug) old.drug = "";
        if (!old.dispense) old.dispense = 0;

        await db.deleteMedication(data.id, data.patient, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete medication", { id: data.id, visit: data.visit, patient: data.patient }));

        // STORAGE
        const match = findDrug(old.drug.match(DRUG_REGEXP));
        if (!match) return;

        const medSuffix = `Medication: ${match.name} (${match.dosage}) (${match.presentation}).`;
        const logSuffix = `${medSuffix} Patient, visit and medication id: ${data.patient}#${data.visit}#${data.id} Account: ${account.name} (${account.id})`;

        // add back
        await storage.modifyDispensible(match, "+", old.dispense, {
            type: "DEL", // deletion
            description: `Medication was deleted. Adding back to storage. ${logSuffix}`
        });
        inventory.find(i => i.name === match.name && i.dosage === match.dosage && i.presentation === match.presentation)
            .dispensible += old.dispense;
    });

    socket.on("import drugs", async data => {
        if (!account || !data || !(data instanceof Array)) return;
        // TODO: don't trust data.
        const modifications = [];
        const recents = [];
        for (const drug of data) {
            const item = inventory.find(i => i.name === drug.name && i.dosage === drug.dosage && i.presentation === drug.presentation);
            if (item) {
                item.dispensible += drug.dispensible;
                if (drug.dispensible) modifications.push(drug);
            } else {
                inventory.push(new Storage.Drug(drug));
                recents.push(drug);
            }
        }

        if (recents.length > 0) await storage.createAll(recents);
        if (modifications.length > 0) await storage.addAll(modifications);
    });

    socket.on("storage search", async data => {
        if (typeof data !== "string" || !account) return;

        socket.emit("search result", await storage.searchDrug(data));
    });

    socket.on("delete diagnosis", async data => {
        if (!account || !data || typeof data.patient !== "string" || typeof data.visit !== "number" || typeof data.id !== "number") return;
        await db.deleteDiagnosis(data.id, data.patient, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete diagnosis", { id: data.id, visit: data.visit, patient: data.patient }));
    });

    socket.on("delete history", async data => {
        if (!account || !data || typeof data.patient !== "string" || typeof data.type !== "string" || typeof data.id !== "number") return;
        if (!["medical", "surgical", "traumatic", "allergic", "hereditary"].includes(data.type)) return;
        await db.deleteHistory(data.type, data.id, data.patient);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete history", { id: data.id, type: data.type, patient: data.patient }));
    });

    socket.on("disconnect", () => {
        sockets.splice(sockets.findIndex(s => s.id === socket.id), 1);
        subs.forEach(s => {
            if (subscriptions[s]) {
                subscriptions[s].splice(subscriptions[s].findIndex(sock => sock.id === socket.id), 1);
                if (subscriptions[s].length < 1) delete subscriptions[s];
            }
        });
        sockets.forEach(s => s.emit("online update", sockets.length-1));
    });
});


function getIPAddress() {
    var interfaces = require('os').networkInterfaces();
    for (var devName in interfaces) {
        var iface = interfaces[devName];

        for (var i = 0; i < iface.length; i++) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                return alias.address;
        }
    }
    return '0.0.0.0';
}
