const DB_NAME = "local-astro-charts";
const STORE_NAME = "charts";
const DB_VERSION = 2;

export function openChartDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
        store.createIndex("profileName", "profileName");
        store.createIndex("subjectType", "subjectType");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveChart(workbook, markdown) {
  const db = await openChartDb();
  const now = new Date().toISOString();
  const chart = workbook.natal || workbook;
  const id = chart.input.id || crypto.randomUUID();
  const historyEntry = {
    at: now,
    jdUt: chart.jdUt,
    title: chart.input.profileName || "未命名星盘",
    birth: `${chart.input.birthDate} ${chart.input.birthTime}`,
    place: chart.input.locationName || "",
  };
  const previous = await getChart(id).catch(() => null);
  const history = [...(previous?.history || []), historyEntry].slice(-50);
  const record = {
    id,
    title: chart.input.profileName || "未命名星盘",
    profileName: chart.input.profileName || "",
    subjectType: chart.input.subjectType || "self",
    tags: splitTags(chart.input.tags),
    workbook: { ...workbook, natal: { ...chart, input: { ...chart.input, id } } },
    chart: { ...chart, input: { ...chart.input, id } },
    markdown,
    history,
    updatedAt: now,
  };
  return transaction(db, "readwrite", (store) => store.put(record)).then(() => record);
}

export async function listCharts() {
  const db = await openChartDb();
  return transaction(db, "readonly", (store) => store.getAll()).then((records) => records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export async function getChart(id) {
  const db = await openChartDb();
  return transaction(db, "readonly", (store) => store.get(id));
}

export async function deleteChart(id) {
  const db = await openChartDb();
  return transaction(db, "readwrite", (store) => store.delete(id));
}

function transaction(db, mode, operation) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = operation(store);
    let result;
    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

function splitTags(value) {
  return String(value || "")
    .split(/[，,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}
