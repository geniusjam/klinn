class Medication {
    constructor(data) {
        this.patient = data.patient;
        this.visit = data.visit;
        this.id = data.id;
        this.drug = data.drug || "";
        this.dose = data.dose || "";
        this.dispense = data.dispense || "";
        this.countedBy = data.countedBy || "";
        this.countedAt = data.countedAt;
        this.filledBy = data.filledBy || "";
        this.filledAt = data.filledAt;
        this.lastEditedAt = data.lastEditedAt || data.createdAt || Date.now();
        this.createdAt = data.createdAt || Date.now();
    }
}

class Diagnosis {
    constructor(data) {
        this.id = data.id;
        this.patient = data.patient;
        this.visit = data.visit;
        this.diagnosis = data.diagnosis || "";
        this.notes = data.notes || "";
    }
}

class Visit {
    constructor(data) {
        this.id = data.id;
        this.patient = data.patient;
        this.date = data.date;
        this.createdBy = data.createdBy;
        this.complaint = data.complaint || "";
        this.complaintNotes = data.complaintNotes || "";
        this.vitalsTemp = data.vitalsTemp || 0;
        this.vitalsWeight = data.vitalsWeight || 0;
        this.vitalsHeight = data.vitalsHeight || 0;
        this.vitalsHeartRate = data.vitalsHeartRate || 0;
        this.vitalsBPA = data.vitalsBPA || 0;
        this.vitalsBPB = data.vitalsBPB || 0;
        this.vitalsO2 = data.vitalsO2 || 0;
        this.vitalsRespRate = data.vitalsRespRate || 0;
        this.bgResults = data.bgResults || "";
        this.bgDate = data.bgDate || "";
        this.bgNotes = data.bgNotes || "";
        this.examDoctor = data.examDoctor || "";
        this.examNotes = data.examNotes || "";
        this.diagnosis = data.diagnosis || "";
        this.diagnosisNotes = data.diagnosisNotes || "";
        this.referredToHospital = data.referredToHospital || false;
        this.lastEditedAt = data.lastEditedAt || data.createdAt || Date.now();

        /** @type {Medication[]} */
        this.pharmacy = [];

        /** @type {Diagnosis[]} */
        this.diagnoses = [];
    }

    nextMedicationID() {
        let id = 1;
        for (const med of this.pharmacy) {
            if (med.id >= id) id = med.id + 1;
        }
        return id;
    }

    nextDiagnosisID() {
        let id = 1;
        for (const diag of this.diagnoses) {
            if (diag.id >= id) id = diag.id + 1;
        }
        return id;
    }
}

//- history start -
class Antecedent {
    constructor(data) {
        this.id = data.id;
        this.patient = data.patient;
    }
}

class MedicalAntecedent extends Antecedent {
    constructor(data) {
        super(data);
        this.disease = data.disease || "";
        this.date = data.date || 0;
        this.treatment = data.treatment || "";
    }
}

class SurgicalAntecedent extends Antecedent {
    constructor(data) {
        super(data);
        this.surgery = data.surgery || "";
        this.date = data.date || 0;
        this.place = data.place || "";
        this.complication = data.complication || "";
    }
}

class TraumaticAntecedent extends Antecedent {
    constructor(data) {
        super(data);
        this.part = data.part || "";
        this.surgery = data.surgery || 0;
        this.date = data.date || 0;
        this.complication = data.complication || "";
    }
}

class AllergicAntecedent extends Antecedent {
    constructor(data) {
        super(data);
        this.name = data.name || "";
    }
}

class HereditaryAntecedent extends Antecedent {
    constructor(data) {
        super(data);
        this.relative = data.relative || "";
        this.disease = data.disease || "";
    }
}
//- history end -

class Patient {
    constructor(data) {
        this.id = data.id;
        this.name = data.name;
        this.lastname = data.lastname;
        this.gender = data.gender;
        this.createdBy = data.createdBy;
        this.photo = data.photo || null;
        this.birthdate = data.birthdate;
        this.createdAt = data.createdAt;
        this.waitedFor = data.waitedFor || 0;
        this.isWaiting = data.isWaiting || 0;
        this.whereis = data.whereis || 0;
        this.lastEditedAt = data.lastEditedAt || data.createdAt || Date.now();

        this.history = {
            medical: [],
            surgical: [],
            traumatic: [],
            allergic: [],
            hereditary: []
        };

        this.gynecoFirstPeriod = data.gynecoFirstPeriod || 0;
        this.gynecoLastPeriod = data.gynecoLastPeriod || 0;
        this.gynecoDuration = data.gynecoDuration || 0;
        this.gynecoRegularity = data.gynecoRegularity || 0;
        this.gynecoAbortions = data.gynecoAbortions || 0;
        this.gynecoCSections = data.gynecoCSections || 0;
        this.gynecoDeliveries = data.gynecoDeliveries || 0;
        this.gynecoLivingChildren = data.gynecoLivingChildren || 0;

        this.prenatalAppointments = data.prenatalAppointments || 0;
        this.prenatalInfection = data.prenatalInfection || "";
        this.prenatalVaccines = data.prenatalVaccines || "";

        this.natalBirth = data.natalBirth || 0;
        this.natalDischarged = data.natalDischarged || 0;

        this.postnatalSupportsHead = data.postnatalSupportsHead || 0;
        this.postnatalSits = data.postnatalSits || 0;
        this.postnatalWalks = data.postnatalWalks || 0;
        this.postnatalSpeaks = data.postnatalSpeaks || 0;
        this.postnatalOthers = data.postnatalOthers || "";
        this.postnatalVaccines = data.postnatalVaccines || "";

        /** @type {Visit[]} */
        this.visits = [];
    }

    nextVisitID() {
        let id = 1;
        for (const visit of this.visits) {
            if (visit.id >= id) id = visit.id + 1;
        }
        return id;
    }

    // why not group them all into one
    // when considering ids?
    nextHistoryID() {
        let id = 1;
        for (const key in this.history) {
            for (const ant of this.history[key]) {
                if (ant.id >= id) id = ant.id + 1;
            }
        }
        return id;
    }
}
