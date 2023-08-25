const sqlite = require("sqlite");
const sqlite3 = require("sqlite3");

class Drug {
    constructor(data) {
        this.name = data.name;
        this.dosage = data.dosage;
        this.presentation = data.presentation;
        this.dispensible = data.dispensible;
        this.category = data.category;
        this.expiration = data.expiration;
    }
}

const init = async () => {
    // DATABASE START
    const db = await sqlite.open({
        filename: "storage.db",
        driver: sqlite3.Database,
    });

    await db.exec("CREATE TABLE IF NOT EXISTS inventory (name TEXT, dosage TEXT, presentation TEXT, dispensible INTEGER, expiration TEXT, category TEXT);");
    await db.exec("CREATE TABLE IF NOT EXISTS logs (date INTEGER, type TEXT, description TEXT)");
    
    async function addLog(type, description) {
        return; // temporarily deactivated
        await db.run("INSERT INTO logs (date,type,description) VALUES (?,?,?)",
            Date.now(), type, description);
    }

    async function getAllInventory() {
        return await db.all("SELECT * FROM inventory");
    }

    /**
     * @param {Drug} drug
     * @param {"+" | "-"} operation 
     * @param {Integer} value
     */
    async function modifyDispensible(drug, operation, value, log) {
        await db.run(`UPDATE inventory SET dispensible = dispensible ${operation} ? WHERE name = ? AND dosage = ? AND presentation = ?`,
            value, drug.name, drug.dosage, drug.presentation);

        await addLog(log.type, log.description);
    }

    async function addAll(drugs) {
        console.log(`Executing ${drugs.length} UPDATE commands on the storage database...`);
        for (const drug of drugs) {
            await db.run(`UPDATE inventory SET dispensible = dispensible + ? WHERE name = ? AND dosage = ? AND presentation = ?`, drug.dispensible, drug.name, drug.dosage, drug.presentation);
        }
        console.log("Execution complete.");
        await addLog("ADDALL", "Modified " + drugs.length + " drugs. (import)");
    }

    async function createAll(drugs) {
        const params = [];
        for (const drug of drugs) {
            params.push(drug.name);
            params.push(drug.dosage);
            params.push(drug.presentation || "");
            params.push(drug.dispensible || 0);
            params.push(drug.expiration || "");
            params.push(drug.category || "");
        }

        await db.run(`INSERT INTO inventory(name,dosage,presentation,dispensible,expiration,category) VALUES ${drugs.map(_ => "(?,?,?,?,?,?)").join(", ")}`,
            ...params);

        await addLog("CREATEALL", "Created " + drugs.length + " drugs. (import)");
    }

    async function searchDrug(str) {
        return await db.all("SELECT * FROM inventory WHERE name LIKE ?", '%' + str + '%');
    }

    // DATABASE END

    return { db, addLog, getAllInventory, modifyDispensible, addAll, createAll, searchDrug };
};

module.exports = { init, Drug };