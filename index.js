const express = require('express');
const path = require("path");
const app = express();
const Database = require("./db");
let db;

app.use(express.static("public/"));

app.get('/', function (req, res) {
    res.sendFile(path.join(__dirname, 'main.html'));
});

console.log("The address is " + getIPAddress() + ":1402");
const server = app.listen({ port: 1402, ip: getIPAddress() }, async () => {
    console.log("Server is ready.");
    db = await Database();
});

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
        socket.emit("welcome", { visits: await db.getAllVisits(), patients: await db.getAllPatients(), pharmacy: await db.getAllPharmacy() }); // TODO: mode for 0-50?
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

    // TODO: edit patient

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
        if (!account || !data || typeof data.id !== "number" || !data.visit || !data.patient) return; // TODO: type checking

        const med = await db.createMedication(data.id, data.patient, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("new medication", med)); // partial
    });

    socket.on("upd medication", async data => {
        // expect patient, visit, field, value
        if (!account || !data || !data.patient || typeof data.visit !== "number" || typeof data.id !== "number" || !data.field || typeof data.value === "undefined") return;
        // TODO: type checking
        // TODO: check the field 

        // change db
        await db.updateMedication(data.id, data.patient, data.visit, data.field, data.value);

        // send update to subscribers
        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd medication", data)) // TODO: some kind of data sanitization for "data"?
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
        // TODO: type checking for data.id

        await db.updatePatient(data.id, data.name, data.lastname, data.gender, data.birthdate);

        // send update to subscribers
        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("upd patient", data)); // TODO: some kind of data sanitization for "data"?
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
        await db.deleteMedication(data.id, data.patient, data.visit);

        sockets.filter(s => s.id !== socket.id).forEach(sock => sock.emit("delete medication", { id: data.id, visit: data.visit, patient: data.patient }));
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
