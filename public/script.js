const socket = io("/");
            
const tabButtons = $('visit tabs').children;
const tabs = [ $("complaint-tab"), $("vitals-tab"), $("bglab-tab"), $("exam-tab"), $("pharmacy-tab"), $("history-tab") ];
const ANTECEDENTALS = { // antecedental structures
    medical: MedicalAntecedent,
    surgical: SurgicalAntecedent,
    traumatic: TraumaticAntecedent,
    allergic: AllergicAntecedent,
    hereditary: HereditaryAntecedent
};

const GENDERS = [ "Male", "Female", "Other" ];
let PAGEN = 25;

let accounts = [];
let account = { name: null, id: null };

/** @type {Patient} */
let currentPatient = null;
/** @type {Visit} */
let currentVisit = null;

let currentPage = 0;
/** @type {Patient[]} */
let currentPatients = [];

socket.once("info accounts", accs => {
    accounts = accs;
    accs.forEach(acc => {
        const medic = document.createElement("medic");

        const button = document.createElement("button");
        button.innerText = acc.name;
        button.onclick = () => {
            account = acc;
            $("overlay").style.display = 'flex';
            $('h3>span').innerText = acc.name;
            $('overlay input').value = "";
            $('overlay input').focus();
        };
        medic.appendChild(button);

        $("medics").appendChild(medic);
    });
});

// TODO
socket.on("disconnect", () => location.reload());

$("overlay>fixed>button").onclick = () => { // Back
    $("overlay").style.display = 'none';
};

$("patients>overlay>fixed>button").onclick = () => { // Back
    $("patients overlay").style.display = 'none';
};

$("patients>overlay.report>fixed>button").onclick = () => { // Back
    $("patients overlay.report").style.display = 'none';
};

$('patients overlay input[type="date"]').onchange = function() {
    if (!this.value) return;
    // affect age.
    const years = Math.floor((Date.now() - (new Date(this.value)).getTime()) / 1000 / 60 / 60 / 24 / 365);
    $("#ageinput0").value = years;
};
$("#ageinput0").onkeyup = function() {
    const num = +(this.value);
    $('patients overlay input[type="date"]').value = fourDigits((new Date()).getUTCFullYear() - num) + '-' + twoDigits(1+(new Date()).getMonth()) + '-' + twoDigits((new Date()).getDate());
};
$('patient-page overlay input[type="date"]').onchange = function() {
    if (!this.value) return;
    // affect age.
    const years = Math.floor((Date.now() - (new Date(this.value)).getTime()) / 1000 / 60 / 60 / 24 / 365);
    $("#ageinput1").value = years;
};
$("#ageinput1").onkeyup = function() {
    const num = +(this.value);
    $('patient-page overlay input[type="date"]').value = fourDigits((new Date()).getUTCFullYear() - num) + '-' + twoDigits(1+(new Date()).getMonth()) + '-' + twoDigits((new Date()).getDate());
};

$("login overlay input").onkeyup = function(event) {
    if (event.key === "Enter") {
        $("login overlay box button").click();
    }
};

$("login overlay box button").onclick = () => { // Go
    // TODO: check if input is suitable
    socket.emit("log in", { id: account.id, password: $("login overlay input").value });
};

socket.on("wrong password", () => alert("Wrong password!"));

/** @type {Patient[]} patients */
let patients = [ { id: '', name: '', lastname: '' } ];
socket.once("welcome", data => {
    $("login").style.display = 'none';

    patients = data.patients.sort((a,b) => (+a.createdAt > +b.createdAt) ? -1 : 1).map(p => new Patient(p));
    data.visits.forEach(visit => patients.find(p => p.id === visit.patient).visits.push(new Visit(visit)));
    patients.forEach(patient => patient.visits.sort((a,b) => (+a.date > +b.date) ? -1 : 1));
    data.pharmacy.forEach(medication =>
        patients.find(p => p.id === medication.patient)
            .visits.find(visit => visit.id === medication.visit)
            .pharmacy.push(new Medication(medication))
    );
    data.diagnoses.forEach(diag =>
        patients.find(p => p.id === diag.patient)
            .visits.find(visit => visit.id === diag.visit)
            .diagnoses.push(new Diagnosis(diag))
    );
    for (const key in data.history) {
        const Ant = ANTECEDENTALS[key];
        data.history[key].forEach(his =>
            patients.find(p => p.id === his.patient)
                .history[key].push(new Ant(his))
        );
    }
    for (const med of data.medications) {
        const option = document.createElement("option");
        option.value = med;
        $("#medicationList").appendChild(option);
    }

    // add patients
    currentPage = 0;
    currentPatients = [ ...patients ];
    displayPatients();
    updateStats();

    $("patients").style.display = 'flex';
});

socket.on("online update", data => {
    $("patients header span").innerText = data;
});

socket.on("new patient", partial => {
    if (patients.find(p => p.id === partial.id)) return; // This is probably the patient we have just added...
    const patient = new Patient(partial);
    patients.unshift(patient);

    if ($("patients header .filter").value === ''
        || (patient.name + " " + patient.lastname).toLocaleLowerCase().includes($("patients header .filter").value.toLocaleLowerCase())) {
            currentPatients.unshift(patient);
            prependPatientStructure(patient);
        } // only if the search bar is empty!!

    updateStats();
});

socket.on("new visit", partial => {
    const patient = patients.find(p => p.id === partial.patient);
    if (patient.visits.find(v => v.id === partial.id)) return; // This is probably the patient we have just added...
    const visit = new Visit(partial);
    patient.visits.unshift(visit);

    if (currentPatient && currentPatient.id === partial.patient) {
        $("visits infobox span").innerText = currentPatient.visits.length;
        prependVisitItemStructure(visit);
    }

    updateStats();
});

$('patients header button').onclick = () => {
    $('patients overlay.report').style.display = 'flex';
    const date = new Date();
    $('patients overlay.report input').value = $('patients overlay.report input.until').value
        = fourDigits(date.getUTCFullYear()) + '-' + twoDigits(1+date.getMonth()) + '-' + twoDigits(date.getDate());
};

$("patients header button.new").onclick = () => {
    $("patients overlay").style.display = 'flex';
    $all("patients input").forEach(el => {
        if (el.type === "radio") el.checked = false;
        else el.value = ''; 
    });
};

$('patients overlay.report box button').onclick = () => { // Create report
    const from = $('patients overlay.report input');
    const until = $('patients overlay.report input.until');
    if (from.value === until.value) return alert("The dates are the same!");
    if (until.value < from.value) return alert("The 'until' date cannot be earlier than the 'from' date!");

    const fromDate = new Date(from.value.replace(/-/g, "/"));
    fromDate.setUTCHours(0, 0, 0, 0);
    const untilDate = new Date(until.value.replace(/-/g, "/"));
    untilDate.setUTCHours(0, 0, 0, 0);

    /** @type {Visit[]} */
    const visits = [];
    patients.forEach(patient =>
        patient.visits.forEach(visit => {
            if (+visit.date >= fromDate.getTime() && +visit.date <= untilDate.getTime())
                visits.push(visit);
        })
    );
    if (visits.length < 1) return alert("No visits!");

    let csv = `"Dates ${fromDate.toLocaleDateString('en', { month: "short", year: "numeric", day: "numeric" })} - ${untilDate.toLocaleDateString('en', { month: "short", year: "numeric", day: "numeric" })}",,\n`;
    csv += ',,\n'
    csv += `Number of Visits,${visits.length},\n`;
    csv += `Referred to the hospital,${visits.filter(v => v.referredToHospital).length},\n`;
    csv += ',,\n'
    csv += 'Gender distribution,,\n'
    GENDERS.filter((q, i) => i !== 2).forEach((g, i) => {
        let count = visits.map(v => patients.find(p => p.id === v.patient).gender).filter(a => a===i).length;
        csv += `${GENDERS[i]},${count},${Math.floor(count/visits.length*100*100)/100}%\n`;
    });

    csv += ',,\n';
    csv += 'Age groups,,\n';
    [[0,5],[6,11],[12,18],[19,26],[27,59],[60,200]]
        .forEach(([from, to]) => {
            let count = visits.map(v => getDate(patients.find(p => p.id === v.patient).birthdate))
                .map(d => Date.now()-d.getTime())
                .map(t => Math.floor(t / 1000 / 60 / 60 / 24 / 365)).filter(a => a >= from && a <= to).length;
            csv += `${from}${to < 200 ? `-${to}` : `+`} years,${count},${Math.floor(count/visits.length*100*100)/100}%\n`;
        });
    
    csv += ',,\n';
    csv += 'Diagnostics,,\n';
    const diagnoses = {};
    visits.forEach(visit => {
        const comma = visit.diagnosis.toLowerCase().split(/, ?/g);
        const list = visit.diagnosis.toLowerCase().split(/ ?\d+\. ?/g).filter(q => q);
        const ds = list.length > comma.length ? list : comma;
        ds.forEach(d => {
            d = d.trim();
            if (diagnoses[d]) diagnoses[d]++;
            else diagnoses[d] = 1;
        });

        visit.diagnoses.forEach(diag => {
            let d = diag.diagnosis.trim();
            if (diagnoses[d]) diagnoses[d]++;
            else diagnoses[d] = 1;
        });
    });

    Object.keys(diagnoses).sort((a,b) => (diagnoses[a] > diagnoses[b] ? -1 : 1)).forEach(key => {
        const count = diagnoses[key];
        key = key.replace(/\"/g, "\"\"");
        csv += `"${key.charAt(0).toUpperCase()}${key.slice(1)}",${count},${Math.floor(count/visits.length*100*100)/100}%\n`;
    });
    
    csv += ',,\n';
    csv += 'Complaints,,\n';
    const complaints = {};
    visits.forEach(visit => {
        const comma = visit.complaint.toLowerCase().split(/, ?/g);
        const list = visit.complaint.toLowerCase().split(/ ?\d+\. ?/g).filter(q => q);
        const ds = list.length > comma.length ? list : comma;
        ds.forEach(d => {
            d = d.trim();
            if (complaints[d]) complaints[d]++;
            else complaints[d] = 1;
        });
    });

    Object.keys(complaints).sort((a,b) => (complaints[a] > complaints[b] ? -1 : 1)).forEach(key => {
        const count = complaints[key];
        key = key.replace(/\"/g, "\"\"");
        csv += `"${key.charAt(0).toUpperCase()}${key.slice(1)}",${count},${Math.floor(count/visits.length*100*100)/100}%\n`;
    });
    
    csv += ',,\n';
    csv += 'Treatment Plans,,\n';
    const medication = {};
    visits.forEach(visit => {
        visit.pharmacy.forEach(med => {
            const d = med.drug.toLowerCase().trim();
            if (medication[d]) medication[d]++;
            else medication[d] = 1;
        });
    });

    Object.keys(medication).sort((a,b) => (medication[a] > medication[b] ? -1 : 1)).forEach(key => {
        const count = medication[key];
        key = key.replace(/\"/g, "\"\"");
        csv += `"${key.charAt(0).toUpperCase()}${key.slice(1)}",${count},${Math.floor(count/visits.length*100*100)/100}%\n`;
    });
    
    download('report.csv', csv);
};

$('patients overlay box button').onclick = () => { // Add Patient
    const name = $("patients overlay input").value;
    const lastname = $("patients overlay input.lastname").value;
    const gender = $('patients overlay input[type="radio"][value="0"]').checked ? 0
        : $('patients overlay input[type="radio"][value="1"]').checked ? 1 : 2;
    const birthdate = parseInt($('patients overlay input[type="date"]').value.replace(/-/g, ""));
    const createdAt = Date.now();
    const createdBy = account.id;
    const id = generatePatientId();

    if (!birthdate) return alert("No birthday entered.");

    $("patients overlay").style.display = 'none';

    const patient = new Patient({ name, lastname, gender, birthdate, createdAt, createdBy, id });

    patients.unshift(patient);
    // patients.sort((a,b) => (+a.createdAt > +b.createdAt) ? -1 : 1);

    if ($("patients header .filter").value === ''
        || (patient.name + " " + patient.lastname).toLocaleLowerCase().includes($("patients header .filter").value.toLocaleLowerCase())) {
            currentPatients.unshift(patient);
            prependPatientStructure(patient);
        } // only if the search bar is empty !!

    socket.emit("new patient", { name, lastname, gender, birthdate, createdAt, id });
};

$("patients-list").onclick = function(event) { // display patient
    let el = event.target;
    while (el !== document.body && el.tagName !== "PATIENT" && el.parentNode) el = el.parentNode;
    if (el.tagName !== "PATIENT") return;

    const patientId = el.getAttribute("patient-id");
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return console.warn("Couldn't find patient ", patientId);
    currentPatient = patient;
    currentVisit = null;


    preparePatientStructure(patient);
    $("patient-details info span").innerText = 'Please select a visit.';
    $("patient-page header patient").innerHTML = $("structures patient").innerHTML;

    $("patient-details select").value = currentPatient.isWaiting;
    $("patient-details .whereis").value = currentPatient.whereis;

    $("visits infobox span").innerText = patient.visits.length;
    $("visits-list").innerHTML = "";
    patient.visits.forEach(visit => addVisitItemStructure(visit));

    for (const type in patient.history) {
        $("antecedents."+type).innerHTML = "<no-data> None. </no-data>";
        for (const ant of patient.history[type])
            $("antecedents."+type).appendChild(buildAntecedent(type, ant));
    }

    for (const key in historyInputs) {
        const input = $("history-tab ." + key);

        fillInput(key, input, patient[key]);
    }

    // update pregnancies and dead children
    $('.pregnancies').innerText = patient.gynecoAbortions + patient.gynecoDeliveries + patient.gynecoCSections;
    $('.deadChildren').innerText = patient.gynecoDeliveries + patient.gynecoCSections - patient.gynecoLivingChildren;

    const lifespan = (Date.now() - getDate(patient.birthdate).getTime());
    const age = Math.floor(lifespan / 1000 / 60 / 60 / 24 / 365);
    if (patient.gender === 1 && age > 7) $("gynecological").style.display = "flex"; // if it's a female older than 7
    else $("gynecological").style.display = "none";

    if (age <= 5) $("natality").style.display = "flex"; // if younger than 5
    else $("natality").style.display = "none";

    $("patient-page").style.display = "flex";
    $("patients").style.display = "none";

    for (const btn of tabButtons) {
        btn.classList.add("gray");
    }
    tabs.forEach(tab => tab.style.display = 'none');

    $('patient-page visits').style.display = 'flex';
};

// update pregnancies and dead children
$('.gynecoAbortions').oninput = $('.gynecoDeliveries').oninput = $('.gynecoCSections').oninput =
    $('.gynecoLivingChildren').oninput = () => updatePregnanciesAndDeadChildren();

function updatePregnanciesAndDeadChildren() {
    $('.pregnancies').innerText = +$('.gynecoAbortions').value + +$('.gynecoDeliveries').value + +$('.gynecoCSections').value;
    $('.deadChildren').innerText = +$('.gynecoDeliveries').value + +$('.gynecoCSections').value - $('.gynecoLivingChildren').value;
}

$("patient-page header button").onclick = () => { // Back
    $("patient-page").style.display = "none";
    $("patients").style.display = "flex";
};

$all("patient-details select").forEach(el => el.onchange = function() {
    const field = this.classList.contains("whereis") ? "whereis" : "isWaiting";
    currentPatient[field] = +this.value;
    const { id, name, lastname, gender, birthdate, whereis, isWaiting } = currentPatient;
    socket.emit("upd patient", { id, name, lastname, gender, birthdate, whereis, isWaiting });
});

$all('history-tab h2 button').forEach(addButton => { // Add history item
    const type = addButton.classList.item(0);
    const Ant = ANTECEDENTALS[type];
    addButton.onclick = function() {
        const id = currentPatient.nextHistoryID();
        const ant = new Ant({ id, patient: currentPatient.id });

        currentPatient.history[type].push(ant);

        $("antecedents."+type).appendChild(buildAntecedent(type, ant));
    
        socket.emit("new history", { type, id, patient: currentPatient.id });
    }
});

function buildAntecedent(type, ant) {
    const html = document.createElement("antecedent");
    html.setAttribute("ant-id", ant.id);

    for (const key in ant) {
        if (key === "patient" || key === "id") continue;

        if (key === "surgery" && type === "traumatic") {
            const select = document.createElement("select");
            select.innerHTML = `<option value="0"> Surgery </option><option value="1"> Immobilization </option>`;
            select.setAttribute("ant-key", key);
            select.onchange = () => {
                let value = +select.value;
                if (value === ant[key]) return; // no change
                ant[key] = value;
                socket.emit("upd history", { type, id: ant.id, patient: ant.patient, field: key, value });
            };
            select.value = ant[key];
            html.appendChild(select);
            continue;
        }

        const input = document.createElement("input");
        input.setAttribute("ant-key", key);

        // all numbers are dates.
        if (typeof ant[key] === "string") {
            input.value = ant[key];
            input.placeholder = key[0].toUpperCase() + key.slice(1);
            input.type = "text";
            input.setAttribute("autocomplete", "off");
        } else {
            // all numbers are dates
            input.type = "date";
            const date = new Date(ant[key]);
            if (ant[key] !== 0) input.value = fourDigits(date.getFullYear()) + "-" + twoDigits(1+date.getMonth()) + "-" + twoDigits(date.getDate());
        }

        input.onchange = () => {
            let val = input.value;
            if (input.type === "date") {
                val = new Date(input.value.replace(/-/g, "/")).getTime();
            }

            if (ant[key] === val) return; // no change

            ant[key] = val;
            socket.emit("upd history", { type, id: ant.id, patient: ant.patient, field: key, value: val });
        };

        html.appendChild(input);
    }

    const button = document.createElement("button");
    button.classList.add("red");
    button.innerText = "-";
    button.onclick = function() { // delete antecedent
        const inx = currentPatient.history[type].findIndex(i => i.id === ant.id);
        currentPatient.history[type].splice(inx, 1);
        html.parentNode.removeChild(html);

        socket.emit("delete history", { type, id: ant.id, patient: ant.patient });
    }
    html.appendChild(button)

    return html;
}

socket.on("new history", ({ type, id, patient }) => {
    const pat = patients.find(p => p.id === patient);
    const Ant = ANTECEDENTALS[type];
    const ant = new Ant({ id, patient });

    pat.history[type].push(ant);

    $("antecedents."+type).appendChild(buildAntecedent(type, ant));
});

socket.on("upd history", ({ type, id, patient, field, value }) => {
    console.log("upd history", {type, id, patient, field, value});
    const pat = patients.find(p => p.id === patient);
    const item = pat.history[type].find(h => h.id === id);
    item[field] = value;

    if (currentPatient && currentPatient.id === patient) {
        const input = $(`antecedents.${type} antecedent[ant-id="${id}"] *[ant-key="${field}"]`); // might also be a select element
        if (input.type === "date") {
            const date = new Date(value);
            input.value = fourDigits(date.getFullYear()) + '-' + twoDigits(1+date.getMonth()) + '-' + twoDigits(date.getDate());
        } else input.value = value;
    }
});

socket.on("delete history", ({ type, id, patient }) => {
    const pat = patients.find(p => p.id === patient);
    const inx = pat.history[type].findIndex(h => h.id === id);

    if (currentPatient && currentPatient.id === patient) {
        const el = $(`antecedents.${type} antecedent[ant-id="${id}"]`);
        el.parentNode.removeChild(el);
    }

    pat.history[type].splice(inx, 1);
});

const historyInputs = {};
[
    // gynecological
    "gynecoFirstPeriod", "gynecoLastPeriod", "gynecoDuration", "gynecoRegularity", "gynecoAbortions",
    "gynecoCSections", "gynecoDeliveries", "gynecoLivingChildren",

    // prenatal
    "prenatalAppointments", "prenatalInfection", "prenatalVaccines",

    // natal
    "natalBirth", "natalDischarged",

    // postnatal
    "postnatalSupportsHead", "postnatalSits", "postnatalWalks", "postnatalSpeaks", "postnatalOthers", "postnatalVaccines"
].forEach(e => tieTo($("history-tab ." + e), e, "patient partial"));

$("visits button").onclick = () => { // New Visit
    const createdAt = Date.now();
    const id = currentPatient.nextVisitID();

    const visit = new Visit({ id, date: createdAt, createdBy: account.id, patient: currentPatient.id });
    currentPatient.visits.unshift(visit);

    $("visits infobox span").innerText = currentPatient.visits.length;

    prependVisitItemStructure(visit);
    $('visits-list visit-item[visit-id="' + visit.id + '"]').click();
    updateStats();

    socket.emit("new visit", { id, createdAt, patient: currentPatient.id });
};

const inputsByField = {};

$('visits-list').onclick = function(event) { // display visit
    let el = event.target;
    while (el !== document.body && el.tagName !== "VISIT-ITEM" && el.parentNode) el = el.parentNode;
    if (el.tagName !== "VISIT-ITEM") return;

    const id = +el.querySelector('span').innerText;
    const visit = currentPatient.visits.find(visit => visit.id === id);

    currentVisit = visit;

    // replace values because the visit has changed.
    $("patient-details info span").innerText = new Date(+visit.date).toLocaleString('en', { month: 'short', day: 'numeric', year: 'numeric', hour12: true, hour: 'numeric', minute: 'numeric' });

    Object.keys(inputsByField).forEach(field => fillInput(field));

    $('patient-details treatments-list').innerHTML = '<no-data> None. </no-data>';
    visit.pharmacy.forEach(med => addTreatmentStructure(med));
    $('patient-details medications-list').innerHTML = '<no-data> None. </no-data>';
    visit.pharmacy.forEach(med => addMedicationStructure(med));

    $('exam-tab diagnoses').innerHTML = '';
    visit.diagnoses.forEach(diag => addDiagnosisStructure(diag));

    if (visit.vitalsHeight !== 0 && visit.vitalsWeight !== 0) { // calculate bmi
        $('vitals-tab table span').innerText = Math.floor(visit.vitalsWeight / (visit.vitalsHeight * visit.vitalsHeight / 100 / 100) * 100) / 100;
    } else $('vitals-tab table span').innerText = '-';


    for (const child of this.children) child.classList.remove('selected');
    el.classList.add('selected');

    // see if there exists a button which is selected (not gray)
    let tab = false;
    for (button of tabButtons) {
        if (!button.classList.contains("gray")) tab = true;
    }
    if (!tab) tabButtons[1].click();

    if (window.innerWidth < 650)  $('patient-page visits').style.display = 'none';
};

function fillInput(field, input, value) {
    if (input === undefined) input = inputsByField[field];
    if (value === undefined) value = currentVisit[field];

    if (input.tagName.toLowerCase() === "select") {
        input.value = +value;
        return;
    }

    if (input.type === "date") {
        // handle date
        if (!value) return input.value = '';
        const date = (new Date(+value));
        input.value = fourDigits(date.getUTCFullYear()) + '-' + twoDigits(1+date.getMonth()) + '-' + twoDigits(date.getDate());
        return;
    }

    if (input.type === "checkbox") {
        input.checked = value ? true : false;
        return;
    }

    if (value === 0) input.value = '';
    else input.value = value;
}

[
    // complaint-tab
    [$('complaint-tab input'), "complaint"],
    [$('complaint-tab .complaintNotes'), "complaintNotes"],

    // vitals-tab
    [$('vitals-tab .vtemp'), "vitalsTemp"],
    [$('vitals-tab .vweight'), "vitalsWeight"],
    [$('vitals-tab .vheight'), "vitalsHeight"],
    [$('vitals-tab .vhr'), "vitalsHeartRate"],
    [$('vitals-tab .vbpa'), "vitalsBPA"],
    [$('vitals-tab .vbpb'), "vitalsBPB"],
    [$('vitals-tab .vo2'), "vitalsO2"],
    [$('vitals-tab .vrr'), "vitalsRespRate"],

    // bglab-tab
    [$('bglab-tab .bgresults'), "bgResults"],
    [$('bglab-tab .bgdate'), "bgDate"],
    [$('bglab-tab .bgnotes'), "bgNotes"],

    // exam-tab
    [$('exam-tab .edoctor'), "examDoctor"],
    [$('exam-tab .enotes'), "examNotes"],
    [$('exam-tab .ediagnosis'), "diagnosis"],
    [$('exam-tab .ediagnosisNotes'), "diagnosisNotes"],
    [$('exam-tab input[type="checkbox"]'), "referredToHospital"],
].forEach(([a,b]) => tieTo(a, b, "visit"));

socket.on("upd visit", ({ field, value, visit: visitId, patient: patientId }) => {
    const patient = patients.find(p => p.id === patientId);
    const visit = patient.visits.find(v => v.id === visitId);
    visit[field] = value;
    if (currentVisit && currentPatient && currentVisit.id === visit.id && currentPatient.id === patient.id) {
        // it's the current visit... we need to update the input
        const input = inputsByField[field];
        input.value = (typeof value === "number" && value === 0) ? '' : value;
        if (input.type === "date") {
            // handle date
            const date = (new Date(+value));
            input.value = fourDigits(date.getUTCFullYear()) + '-' + twoDigits(1+date.getMonth()) + '-' + twoDigits(date.getDate());
        }

        if (input.type === "checkbox") {
            input.checked = value ? true : false;
        }
    }
});

$('vitals-tab .vweight').onkeyup = $('vitals-tab .vheight').onkeyup = function() {
    const weight = $('vitals-tab .vweight').value;
    const height = $('vitals-tab .vheight').value;

    let bmi = '-';
    if (weight && height) {
        bmi = weight / height / height * 100 * 100;
        bmi = Math.floor(bmi * 100) / 100
    }

    $('vitals-tab table span').innerText = bmi;
};

$('patients header .filter').onkeyup = function() {
    if (this.value === "") currentPatients = [ ...patients ];
    else currentPatients = patients.filter(p => (p.name + " " + p.lastname).toLocaleLowerCase().includes(this.value.toLocaleLowerCase()));
    currentPage = 0;
    displayPatients();
};

function tieTo(input, field, type) {
    if (type === "patient partial") historyInputs[field] = input;
    else inputsByField[field] = input;
    input.onchange = function() {
        let val = input.value;
        if (input.type === "number" && val === '') {
            val = 0;
        }
        if (input.type === "number") val = +val;
        if (input.type === "checkbox") val = input.checked ? 1 : 0;
        if (input.type === "date" && val) {
            val = (new Date(val)).getTime();
        }
        if (input.tagName.toLowerCase() === "select") {
            val = +val;
        }
        if (type === "visit" ? (val === currentVisit[field]) : (val === currentPatient[field])) return; // no change

        if (type === "visit") currentVisit[field] = val;
        else currentPatient[field] = val;
        const payload = { field, value: val };
        if (type === "visit") {
            payload.patient = currentPatient.id;
            payload.visit = currentVisit.id;
        } else payload.id = currentPatient.id;
        socket.emit("upd " + type, payload);
    };
}

$('patient-details .red').onclick = () => { // delete patient
    const result = confirm(`Are you sure you want to delete this patient?\n${currentPatient.name} ${currentPatient.lastname} (${currentPatient.id})`);
    if (!result) return;

    let ch = null;
    for (const child of $('patients-list').children) {
        if (child.getAttribute("patient-id") === currentPatient.id) ch = child;
    }
    if (ch) $('patients-list').removeChild(ch);

    patients.splice(patients.findIndex(p => p.id === currentPatient.id), 1);

    $('patient-page').style.display = 'none';
    $('patients').style.display = 'flex';

    socket.emit("delete patient", currentPatient.id);
    updateStats();

    currentPatient = null;
}

socket.on("delete patient", patient => {
    const index = patients.findIndex(p => p.id === patient);
    if (index < 0) return; // we have already deleted it?
    patients.splice(index, 1);

    let ch = null;
    for (const child of $('patients-list').children) {
        if (child.getAttribute("patient-id") === patient) ch = child;
    }
    if (ch) $('patients-list').removeChild(ch);

    if (currentPatient && currentPatient.id === patient) {
        $('patient-page').style.display = 'none';
        $('patients').style.display = 'flex';
    }

    updateStats();
});

$('complaint-tab button').onclick = function() { // delete visit
    if (!confirm(`Are you sure you want to delete Visit ${currentVisit.id}?`)) return;

    socket.emit("delete visit", { patient: currentPatient.id, id: currentVisit.id });

    clearVisit(currentVisit.id);
    updateStats();
}

socket.on("delete visit", ({ id, patient: patientId }) => {
    if (currentPatient && currentPatient.id === patientId) {
        clearVisit(id);
    } else {
        const patient = patients.find(p => p.id === patientId);
        const visiti = patient.visits.findIndex(v => v.id === id);
        patient.visits.splice(visiti, 1);
    }
    updateStats();
});

function clearVisit(id) {
    $("visits-list").removeChild($(`visits-list visit-item[visit-id="${id}"]`));
    currentPatient.visits.splice(currentPatient.visits.findIndex(v => v.id === id), 1);
    $("visits infobox span").innerText = currentPatient.visits.length;

    if (currentVisit && currentVisit.id === id) {
        currentVisit = null;
        $("patient-details info span").innerText = 'Please select a visit.';

        for (const btn of tabButtons) {
            btn.classList.add("gray");
        }
        tabs.forEach(tab => tab.style.display = 'none');
    }
}

$("exam-tab .add").onclick = function() { // Add diagnosis
    const id = currentVisit.nextDiagnosisID();
    const diag = new Diagnosis({ id, visit: currentVisit.id, patient: currentPatient.id });
    currentVisit.diagnoses.push(diag);
    addDiagnosisStructure(diag);

    socket.emit("new diagnosis", { id, visit: currentVisit.id, patient: currentPatient.id });
}

function addDiagnosisStructure(diag) {
    const row = document.createElement("row");
    row.innerHTML = $('exam-tab div row').innerHTML;
    row.setAttribute("diagnosis-id", diag.id);

    row.querySelector(".ediagnosis").value = diag.diagnosis;
    row.querySelector(".ediagnosisNotes").value = diag.notes;

    row.querySelectorAll("input").forEach(el => {
        el.onchange = () => {
            const field = el.classList.contains("ediagnosis") ? "diagnosis" : "notes";
            if (el.value === diag[field]) return; // no change
            diag[field] = el.value;
            socket.emit("upd diagnosis", { id: diag.id, visit: diag.visit, patient: diag.patient, field, value: el.value });
        };
    });

    $('exam-tab diagnoses').appendChild(row);
}

$("exam-tab .remove").onclick = function() { // Remove diagnosis
    const node = $('exam-tab diagnoses').lastChild;
    if (!node || !node.getAttribute) return;
    const id = +node.getAttribute("diagnosis-id");
    currentVisit.diagnoses.splice(currentVisit.diagnoses.findIndex(q => q.id === id), 1);
    $('exam-tab diagnoses').removeChild(node);
    socket.emit("delete diagnosis", { visit: currentVisit.id, id, patient: currentPatient.id });
}

socket.on("new diagnosis", ({ id, patient, visit }) => {
    const pat = patients.find(p => p.id === patient);
    const vis = pat.visits.find(v => v.id === visit);
    const diag = new Diagnosis({ id, patient, visit });
    vis.diagnoses.push(diag);

    if (currentPatient && currentVisit && currentPatient.id === patient && currentVisit.id === visit) {
        addDiagnosisStructure(diag);
    }
});

socket.on("upd diagnosis", ({ id, patient, visit, field, value }) => {
    const pat = patients.find(p => p.id === patient);
    const vis = pat.visits.find(v => v.id === visit);
    const diag = vis.diagnoses.find(d => d.id === id);
    diag[field] = value;

    if (currentPatient && currentVisit && currentPatient.id === patient && currentVisit.id === visit) {
        $(`diagnoses row[diagnosis-id="${id}"] .ediagnosis` + (field === "notes" ? "Notes" : "")).value = value;
    }

});

socket.on("delete diagnosis", ({ id, patient, visit }) => {
    const pat = patients.find(p => p.id === patient);
    const vis = pat.visits.find(v => v.id === visit);
    const inx = vis.diagnoses.findIndex(d => d.id === id);
    if (inx > -1) vis.diagnoses.splice(inx, 1);

    if (currentPatient && currentVisit && currentVisit.id === visit && currentPatient.id === patient) {
        const el = $(`diagnoses row[diagnosis-id="${id}"]`);
        if (el) el.parentNode.removeChild(el);
    }
});

$('exam-tab .treatmentPlan h2 button').onclick = function() { // Add Treatment
    const createdAt = Date.now();
    const med = new Medication({ createdAt, patient: currentPatient.id, visit: currentVisit.id, id: currentVisit.nextMedicationID() });
    currentVisit.pharmacy.push(med);
    addTreatmentStructure(med);
    addMedicationStructure(med);

    $('exam-tab').scrollTo(0, $('exam-tab').scrollHeight);

    socket.emit("new medication", { createdAt, patient: med.patient, visit: med.visit, id: med.id });
}

socket.on("new medication", ({ id, patient, visit, createdAt }) => {
    const med = new Medication({ createdAt, patient: currentPatient.id, visit: currentVisit.id, id: currentVisit.nextMedicationID() });
    patients.find(p => p.id === patient).visits.find(v => v.id === visit).pharmacy.push(med);

    if (currentPatient && currentVisit && currentPatient.id === patient && currentVisit.id === visit) {
        // add required structures
        addTreatmentStructure(med);
        addMedicationStructure(med);
    }
});

socket.on("upd medication", ({ id, patient: patientId, visit: visitId, field, value }) => {
    const patient = patients.find(p => patientId === p.id);
    const visit = patient.visits.find(v => v.id === visitId);
    const med = visit.pharmacy.find(m => m.id === id);
    med[field] = value;

    if (currentPatient && currentVisit && currentPatient.id === patient.id && currentVisit.id === visit.id) {
        if (field === "dose" || field === "dispense" || field === "drug") {
            $('medications-list medication[medication-id="' + med.id + '"] .m' + field).innerText = value === 0 ? '' : value;
            $('treatments-list treatment[medication-id="' + med.id + '"] .m' + field).value = value === 0 ? '' : value;
        } else {
            // counted or filled
            prepareMedicationStructure(med);
            $('medications-list medication[medication-id="' + med.id + '"] counted').style.display = $('structures medication counted').style.display;
            $('medications-list medication[medication-id="' + med.id + '"] filled').style.display = $('structures medication filled').style.display;
            $('medications-list medication[medication-id="' + med.id + '"] not-counted').style.display = $('structures medication not-counted').style.display;
            $('medications-list medication[medication-id="' + med.id + '"] not-filled').style.display = $('structures medication not-filled').style.display;

            if (!value) return; // value = ''
            let date;
            switch (field) {
                case "filledAt":
                    date = new Date(+value);
                    $('medications-list medication[medication-id="' + med.id + '"] filled .foot').innerText
                        = fourDigits(date.getUTCFullYear()) + '/' + twoDigits(1+date.getMonth()) + '/' + twoDigits(date.getDate());
                    break;
                case "filledBy":
                    $('medications-list medication[medication-id="' + med.id + '"] filled .mid').innerText
                        = accounts.find(a => a.id === value) ? accounts.find(a => a.id === value).name : "Unknown";
                    break;
                case "countedAt":
                    date = new Date(+value);
                    $('medications-list medication[medication-id="' + med.id + '"] counted .foot').innerText
                        = fourDigits(date.getUTCFullYear()) + '/' + twoDigits(1+date.getMonth()) + '/' + twoDigits(date.getDate());
                    break;
                case "countedBy":
                    $('medications-list medication[medication-id="' + med.id + '"] counted .mid').innerText
                        = accounts.find(a => a.id === value) ? accounts.find(a => a.id === value).name : "Unknown";
                    break;
            }
        }
    }
});

socket.on("delete medication", ({ id, patient: patientId, visit: visitId }) => {
    const patient = patients.find(p => patientId === p.id);
    const visit = patient.visits.find(v => v.id === visitId);
    const medi = visit.pharmacy.findIndex(m => m.id === id);
    visit.pharmacy.splice(medi, 1);

    if (currentPatient && currentVisit && currentPatient.id === patient.id && currentVisit.id === visit.id) {
        $("medications-list").removeChild($('medications-list medication[medication-id="' + id + '"]'));
        $("treatments-list").removeChild($('treatments-list treatment[medication-id="' + id + '"]'));
    }
});

$('patient-page header patient').onclick = function() { // open edit patient overlay
    fillEditPatientOverlay();


    $('patient-page overlay').style.display = 'flex';
};

$('patient-page overlay box button').onclick = function() { // Save patient
    const name = $('patient-page overlay input').value;
    const lastname = $('patient-page overlay .lastname').value;
    const gender = $('patient-page overlay input[type="radio"][value="0"]').checked ? 0
        : $('patient-page overlay input[type="radio"][value="1"]').checked ? 1 : 2;
    const birthdate = parseInt($('patient-page overlay input[type="date"]').value.replace(/-/g, ""));

    if (name === currentPatient.name && lastname === currentPatient.lastname
        && gender === currentPatient.gender && birthdate === currentPatient.birthdate)
        return; // no modifications
    
    // at least 1 modification
    currentPatient.name = name;
    currentPatient.lastname = lastname;
    currentPatient.gender = gender;
    currentPatient.birthdate = birthdate;

    // update patient-page patient html:
    preparePatientStructure(currentPatient);
    $('patient-page patient').innerHTML = $('structures patient').innerHTML;

    const el = $('patients-list patient[patient-id="' + currentPatient.id + '"]');
    if (el) {
        // TODO: check if new patient object still suitable for the filter
        preparePatientStructure(currentPatient);
        el.innerHTML = $('structures patient').innerHTML;
    }


    socket.emit("upd patient", { id: currentPatient.id, name, lastname, gender, birthdate, whereis: currentPatient.whereis, isWaiting: currentPatient.isWaiting });

    $('patient-page overlay').style.display = 'none';
};

socket.on("upd patient partial", ({ id, field, value }) => {
    // it's from the history tab...
    const patient = patients.find(p => p.id === id);
    patient[field] = value;

    if (currentPatient && currentPatient.id === id) {
        const el = $("history-tab ."+field);
        if (el) {// just in case
            fillInput(field, el, value);
            updatePregnanciesAndDeadChildren();
        }
    }
});

socket.on("upd patient", ({ id, name, lastname, gender, birthdate, whereis, isWaiting }) => {
    const patient = patients.find(p => p.id === id);
    patient.name = name;
    patient.lastname = lastname;
    patient.gender = gender;
    patient.birthdate = birthdate;
    patient.whereis = whereis;
    patient.isWaiting = isWaiting;

    const el = $('patients-list patient[patient-id="' + id + '"]');
    if (el) {
        // TODO: check if new patient object suitable for the filter
        preparePatientStructure(patient);
        el.innerHTML = $('structures patient').innerHTML;
    }

    // handle the case when overlay is on for this patient
    if (currentPatient && currentPatient.id === id) { // we will generalize the above posed problem to this condition
        // we will fill the overlay even if it's not on
        fillEditPatientOverlay();
        // update patient-page patient html:
        preparePatientStructure(currentPatient);
        $('patient-page patient').innerHTML = $('structures patient').innerHTML;

        $("patient-details select").value = currentPatient.isWaiting;
        $("patient-details .whereis").value = currentPatient.whereis;
        
        const lifespan = (Date.now() - getDate(patient.birthdate).getTime());
        const age = Math.floor(lifespan / 1000 / 60 / 60 / 24 / 365);
        if (patient.gender === 1 && age > 7) $("gynecological").style.display = "flex"; // if it's a female older than 7
        else $("gynecological").style.display = "none";

        if (age <= 5) $("natality").style.display = "flex"; // if younger than 5
        else $("natality").style.display = "none";
    }
});

$('patient-page overlay button').onclick = function() { // Back // close edit patient overlay
    $('patient-page overlay').style.display = 'none';
};

$('patients footer button').onclick = function() { // previous page
    currentPage--;
    if (currentPage < 0) {
        currentPage = 0;
        return;
    }

    displayPatients();
}

$('patients footer button.forward').onclick = function() { // next page
    currentPage++;
    if (currentPatients.length <= currentPage*PAGEN) {
        currentPage--;
        return;
    }

    displayPatients();
}

function fillEditPatientOverlay() {
    $('patient-page overlay input').value = currentPatient.name;
    $('patient-page overlay .lastname').value = currentPatient.lastname;
    $all('patient-page overlay input[type="radio"]').forEach(input => input.checked = false);
    $('patient-page overlay input[type="radio"][value="' + currentPatient.gender + '"]').checked = true; // will break if more than 3 genders

    const date = getDate(currentPatient.birthdate);
    $('patient-page overlay input[type="date"]').value = fourDigits(date.getUTCFullYear()) + '-' + twoDigits(1+date.getMonth()) + '-' + twoDigits(date.getDate()); // TODO

    const allTime = (Date.now() - date.getTime());
    const years = Math.floor(allTime / 1000 / 60 / 60 / 24 / 365);
    $('patient-page overlay #ageinput1').value = years;
}

function updateStats() {
    $("patients header small span").innerText = patients.length;

    // X visits today:
    const date = new Date()
    date.setUTCHours(0, 0, 0, 0);
    $("patients header small .today").innerText = patients.map(p => p.visits.filter(v => +v.date > date.getTime()).length).reduce((p, c) => p + c, 0);
}

tabs.forEach((el, inx) => {
    const name = el.tagName.split("-")[0].toLowerCase();
    $("tabs ."+name).onclick = function() {
        if (inx < 5 && !currentVisit) return; // do nothing
        tabs.forEach(tab => tab.style.display = 'none');
        tabs[inx].style.display = 'flex';

        for (const btn of tabButtons) {
            btn.classList.add("gray");
        }
        this.classList.remove('gray');
    }
});


function download(filename, text) {
    var element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function displayPatients() {
    const total = currentPatients.length;

    $('patients-list').innerHTML = '<no-data> None. </no-data>'; // remove all patients
    currentPatients.slice(currentPage*PAGEN, currentPage*PAGEN+PAGEN).forEach(p => addPatientStructure(p));
    $('patients footer span').innerText = currentPage+1;
    $('patients footer .foot').innerText = `${currentPage*PAGEN+1}-${Math.min((currentPage+1)*PAGEN, total)} of ${total}`;
}

function fourDigits(num) {
    let str = "";
    if (num < 1000) str += "0";
    if (num < 100) str += "0";
    if (num < 10) str += "0";
    return str + num;
}

function twoDigits(num) {
    if (num < 10) return "0" + num;
    else return num;
}

function generatePatientId() {
    let id = null;
    do {
        id = generateId();
    } while (patients.find(p => p.id === id));
    return id;
}

function addTreatmentStructure(med) {
    const treatment = document.createElement('treatment');
    treatment.innerHTML = $('structures treatment').innerHTML;
    treatment.setAttribute('medication-id', med.id);
    treatment.querySelector('.mdrug').value = med.drug;
    treatment.querySelector('.mdose').value = med.dose;
    treatment.querySelector('.mdispense').value = med.dispense;
    $('treatments-list').appendChild(treatment);

    // add listeners
    treatment.querySelector('.mdose').onchange
        = treatment.querySelector('.mdispense').onchange
        = treatment.querySelector('.mdrug').onchange
        = function() { // update medication
            let field = "drug";
            let value = this.value;
            if (this.classList.contains("mdispense")) field = "dispense";
            else if (this.classList.contains("mdose")) field = "dose";
            if (!value && this.type === "number") value = 0;
            
            if (med[field] === value) return; // no change
            med[field] = value;

            $('medications-list medication[medication-id="' + med.id + '"] .m' + field).innerText = value === 0 ? '' : value;

            socket.emit("upd medication", { id: med.id, patient: med.patient, visit: med.visit, field, value  });
        };
    
    treatment.querySelector("button.red").onclick = function() { // delete medication
        currentVisit.pharmacy.splice(currentVisit.pharmacy.findIndex(m => m.id === med.id), 1);

        $('treatments-list').removeChild(treatment);
        $('medications-list').removeChild($('medications-list medication[medication-id="' + med.id + '"]'));

        socket.emit("delete medication", { id: med.id, patient: med.patient, visit: med.visit });
    }
}

function addMedicationStructure(med) {
    prepareMedicationStructure(med);

    const medication = document.createElement('medication');
    medication.setAttribute('medication-id', med.id);
    medication.innerHTML = $('structures medication').innerHTML;
    medication.querySelector('not-counted button').onclick = () => { // Count
        med.countedBy = account.id;
        med.countedAt = Date.now();

        medication.querySelector('counted .mid').innerText = account.name;
        medication.querySelector('counted .foot').innerText = fourDigits((new Date()).getUTCFullYear()) + '/' + twoDigits(1+(new Date()).getMonth()) + '/' + twoDigits((new Date()).getDate());

        medication.querySelector('not-counted').style.display = 'none';
        medication.querySelector('counted').style.display = 'block';

        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'countedBy', value: med.countedBy });
        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'countedAt', value: med.countedAt });
    };
    medication.querySelector('counted button').onclick = () => { // Uncount
        med.countedAt = '';
        med.countedBy = '';
        medication.querySelector('not-counted').style.display = 'flex';
        medication.querySelector('counted').style.display = 'none';

        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'countedBy', value: med.countedBy });
        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'countedAt', value: med.countedAt });
    };
    medication.querySelector('not-filled button').onclick = () => { // Fill
        med.filledBy = account.id;
        med.filledAt = Date.now();

        medication.querySelector('filled .mid').innerText = account.name;
        medication.querySelector('filled .foot').innerText = fourDigits((new Date()).getUTCFullYear()) + '/' + twoDigits(1+(new Date()).getMonth()) + '/' + twoDigits((new Date()).getDate());

        medication.querySelector('not-filled').style.display = 'none';
        medication.querySelector('filled').style.display = 'block';

        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'filledBy', value: med.filledBy });
        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'filledAt', value: med.filledAt });
    };
    medication.querySelector('filled button').onclick = () => { // Unfill
        med.filledAt = '';
        med.filledBy = '';
        medication.querySelector('not-filled').style.display = 'flex';
        medication.querySelector('filled').style.display = 'none';

        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'filledBy', value: med.filledBy });
        socket.emit('upd medication', { id: med.id, patient: med.patient, visit: med.visit, field: 'filledAt', value: med.filledAt });
    };
    $('medications-list').appendChild(medication);
}

function prepareMedicationStructure(med) {
    $('structures medication').setAttribute('medication-id', med.id);
    $('structures medication .mdrug').innerText = med.drug;
    $('structures medication .mdose').innerText = med.dose;
    $('structures medication .mdispense').innerText = med.dispense;

    if (med.countedAt || med.countedBy) {
        $('structures medication counted').style.display = 'block';
        $('structures medication not-counted').style.display = 'none';
    } else {
        $('structures medication counted').style.display = 'none';
        $('structures medication not-counted').style.display = 'flex';
    }
    $('structures medication counted .mid').innerText = accounts.find(a => a.id === med.countedBy)
        ? accounts.find(a => a.id === med.countedBy).name : "Unknown";
    if (med.countedAt) {
        const date = new Date(+med.countedAt);
        $('structures medication counted .foot').innerText = fourDigits(date.getUTCFullYear()) + '/' + twoDigits(1+date.getMonth()) + '/' + twoDigits(date.getDate());
    } else $('structures medication counted .foot').innerText = '';

    if (med.filledAt || med.filledBy) {
        $('structures medication filled').style.display = 'block';
        $('structures medication not-filled').style.display = 'none';
    } else {
        $('structures medication filled').style.display = 'none';
        $('structures medication not-filled').style.display = 'flex';
    }
    $('structures medication filled .mid').innerText = accounts.find(a => a.id === med.filledBy)
        ? accounts.find(a => a.id === med.filledBy).name : "Unknown";
    if (med.filledAt) {
        const date = new Date(+med.filledAt);
        $('structures medication filled .foot').innerText = fourDigits(date.getUTCFullYear()) + '/' + twoDigits(1+date.getMonth()) + '/' + twoDigits(date.getDate());
    } else $('structures medication filled .foot').innerText = '';
}

function addVisitItemStructure(visit) {
    prepareVisitItemStructure(visit);
    $("visits-list").innerHTML += $("structures visit-item").outerHTML;
}

function prependVisitItemStructure(visit) {
    prepareVisitItemStructure(visit);
    $("visits-list").innerHTML = $("structures visit-item").outerHTML + $("visits-list").innerHTML;
}

function prepareVisitItemStructure(visit) {
    $('structures visit-item').setAttribute('visit-id', visit.id);
    $('structures visit-item span').innerText = visit.id;
    const date = new Date(+visit.date);
    $('structures visit-item small').innerText = date.getFullYear() + "/" + twoDigits(1+date.getMonth()) + "/" + twoDigits(date.getDate());
}

function addPatientStructure(p) {
    preparePatientStructure(p);
    $("patients-list").innerHTML += $("structures patient").outerHTML;
}

function prependPatientStructure(p) {
    preparePatientStructure(p);
    $("patients-list").innerHTML = $("structures patient").outerHTML + $("patients-list").innerHTML;
}

function preparePatientStructure(p) {
    $("structures patient").setAttribute("patient-id", p.id);
    $("structures patient h2").innerText = p.name + " " + p.lastname;
    $("structures patient .mid").innerText = `ID: ${p.id} • ${GENDERS[p.gender]}`; // • ${p.visits.length} visit${p.visits.length === 1 ? "" : "s"}
    $("structures patient .foot").innerText = `${getAgeString(p.birthdate)} • DOB: ${Math.floor(p.birthdate / 10_000)}/${twoDigits(Math.floor(p.birthdate / 100) % 100)}/${twoDigits(p.birthdate % 100)}`;
}

function getDateString(date) {
    return `${Math.floor(date / 10_000)}/${Math.floor(date / 100) % 100}/${date % 100}`;
}

function getDate(birthdate) {
    return new Date(getDateString(birthdate));
}

function getAgeString(date) {
    const allTime = (Date.now() - getDate(date).getTime());
    const years = Math.floor(allTime / 1000 / 60 / 60 / 24 / 365);
    if (years > 0) return `${years} year${years === 1 ? "": "s"}`;
    const months = Math.floor(allTime / 1000 / 60 / 60 / 24 / 30);
    return `${Math.floor(months)} month${Math.floor(months) === 1 ? "" : "s"}`;
}

function generateId() {
    let str = "";
    const alph = "1234567890";
    for (let i = 0; i < 10; i++) { // Each ID will be of length 8
        str += alph[Math.floor(Math.random() * alph.length)];
    }
    return str;
}