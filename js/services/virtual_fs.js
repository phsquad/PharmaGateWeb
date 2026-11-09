/**
 * js/services/virtual_fs.js - Виртуальная Файловая Система (VFS) PharmaGateWeb на IndexedDB
 * 
 * Архитектура:
 * 1. 📂 Локальное древовидное хранилище (VFS) на IndexedDB (база "PharmaGateVFS")
 * 2. 🛡️ 100% клиентская сохранность без бэкенда (данные живут в браузере под 152-ФЗ)
 * 3. 🔄 Двусторонний мост: Drag & Drop из реальной Windows/macOS ➔ VFS ➔ Скачивание на диск
 * 4. ⚡ Автоматический in-memory fallback для headless-тестов и приватных вкладок
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class VirtualFS {
    static DB_NAME = "PharmaGateVFS";
    static DB_VERSION = 1;
    static STORE_FILES = "files";

    constructor() {
        this.isReady = false;
        this.db = null;
        this._memFiles = new Map(); // In-memory fallback
    }

    async init() {
        if (typeof indexedDB === 'undefined') {
            this._seedMemoryFiles();
            this.isReady = true;
            return;
        }

        try {
            this.db = await this._openDB();
            await this._seedInitialFilesIfEmpty();
            this.isReady = true;
        } catch (err) {
            console.warn('[VirtualFS] Не удалось открыть IndexedDB, активирован in-memory режим:', err);
            this._seedMemoryFiles();
            this.isReady = true;
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(VirtualFS.DB_NAME, VirtualFS.DB_VERSION);

            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains(VirtualFS.STORE_FILES)) {
                    const store = idb.createObjectStore(VirtualFS.STORE_FILES, { keyPath: "path" });
                    store.createIndex("parent", "parent", { unique: false });
                    store.createIndex("type", "type", { unique: false });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _seedInitialFilesIfEmpty() {
        const rootItems = await this.readdir("C:");
        if (rootItems.length > 0) return;

        // Создаем базовую системную структуру
        await this.mkdir("C:/Документы");
        await this.mkdir("C:/Загрузки");
        await this.mkdir("C:/База_ERP");
        await this.mkdir("C:/Схемы_DBF");

        // Демо-накладная (текстовый аналог/демо)
        const demoInvoiceData = "NAKL_ID;DATE;SUPPLIER;INN;SUMM\n408;09.11.2026;ЗАО ПРОТЕК;7724000000;284500.00\n";
        await this.writeFile("C:/Документы/Накладная_408_Протек.csv", demoInvoiceData, "text/csv");

        // Демо протокол ЖНВЛП
        const demoJnvlpData = "ЖНВЛП ПРОТОКОЛ СОГЛАСОВАНИЯ ЦЕН (ПП РФ № 865)\nРегион: г. Москва\nПредельная надбавка опт: 12%\nПредельная надбавка розн: 15%\n";
        await this.writeFile("C:/Документы/Протокол_ЖНВЛП_Москва.txt", demoJnvlpData, "text/plain");

        // Инструкция приемщика
        const demoReadme = "Инструкция приемщика склада PharmaGate EDI:\n1. Для приемки маркированного товара наведите Камеру ТСД на DataMatrix код.\n2. Для сверки цен откройте калькулятор ЖНВЛП.\n3. Все файлы сохраняются локально в виртуальную систему IndexedDB.\n";
        await this.writeFile("C:/Документы/Инструкция_Приемщика_МДЛП.txt", demoReadme, "text/plain");

        // Схема полей
        const demoSchemaJson = JSON.stringify({
            name: "Стандартная схема накладной",
            fields: ["CODEPST", "NAME", "QNT", "PRICE1", "SUMPAY", "SERIES", "GDATE"]
        }, null, 2);
        await this.writeFile("C:/Схемы_DBF/nakl_standart_schema.json", demoSchemaJson, "application/json");

        // Файл базы SQLite
        const demoSqliteDummy = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);
        await this.writeFile("C:/База_ERP/grls_catalog_12k.sqlite", demoSqliteDummy, "application/x-sqlite3");
    }

    _seedMemoryFiles() {
        this._memFiles.clear();
        this._memFiles.set("C:", { path: "C:", name: "C:", parent: "", type: "folder", updatedAt: Date.now() });
        this._memFiles.set("C:/Документы", { path: "C:/Документы", name: "Документы", parent: "C:", type: "folder", updatedAt: Date.now() });
        this._memFiles.set("C:/Загрузки", { path: "C:/Загрузки", name: "Загрузки", parent: "C:", type: "folder", updatedAt: Date.now() });
        this._memFiles.set("C:/База_ERP", { path: "C:/База_ERP", name: "База_ERP", parent: "C:", type: "folder", updatedAt: Date.now() });
        this._memFiles.set("C:/Схемы_DBF", { path: "C:/Схемы_DBF", name: "Схемы_DBF", parent: "C:", type: "folder", updatedAt: Date.now() });

        this._memFiles.set("C:/Документы/Накладная_408_Протек.csv", {
            path: "C:/Документы/Накладная_408_Протек.csv",
            name: "Накладная_408_Протек.csv",
            parent: "C:/Документы",
            type: "file",
            mime: "text/csv",
            size: 85,
            updatedAt: Date.now(),
            content: "NAKL_ID;DATE;SUPPLIER;INN;SUMM\n408;09.11.2026;ЗАО ПРОТЕК;7724000000;284500.00\n"
        });
    }

    normalizePath(p) {
        if (!p) return "C:";
        let clean = p.replace(/\\/g, "/").replace(/\/+/g, "/").trim();
        if (clean.endsWith("/") && clean.length > 2) clean = clean.slice(0, -1);
        if (!clean.startsWith("C:")) clean = "C:/" + clean.replace(/^[\/]+/, "");
        if (clean === "C:/") clean = "C:";
        return clean;
    }

    getParentPath(p) {
        const norm = this.normalizePath(p);
        if (norm === "C:") return "";
        const idx = norm.lastIndexOf("/");
        if (idx <= 2) return "C:";
        return norm.slice(0, idx);
    }

    getName(p) {
        const norm = this.normalizePath(p);
        if (norm === "C:") return "Диск C:";
        const idx = norm.lastIndexOf("/");
        return norm.slice(idx + 1);
    }

    async readdir(dirPath) {
        const norm = this.normalizePath(dirPath);

        if (!this.db) {
            const list = [];
            for (const [p, item] of this._memFiles.entries()) {
                if (item.parent === norm) list.push({ ...item });
            }
            return list.sort((a, b) => (b.type === 'folder' ? 1 : 0) - (a.type === 'folder' ? 1 : 0) || a.name.localeCompare(b.name));
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_FILES, "readonly");
            const store = tx.objectStore(VirtualFS.STORE_FILES);
            const index = store.index("parent");
            const request = index.getAll(IDBKeyRange.only(norm));

            request.onsuccess = () => {
                const items = request.result || [];
                items.sort((a, b) => (b.type === 'folder' ? 1 : 0) - (a.type === 'folder' ? 1 : 0) || a.name.localeCompare(b.name));
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async stat(filePath) {
        const norm = this.normalizePath(filePath);

        if (!this.db) {
            return this._memFiles.get(norm) || null;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_FILES, "readonly");
            const store = tx.objectStore(VirtualFS.STORE_FILES);
            const request = store.get(norm);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async mkdir(dirPath) {
        const norm = this.normalizePath(dirPath);
        const parent = this.getParentPath(norm);
        const name = this.getName(norm);

        const record = {
            path: norm,
            name: name,
            parent: parent,
            type: "folder",
            size: 0,
            updatedAt: Date.now()
        };

        if (!this.db) {
            this._memFiles.set(norm, record);
            return record;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_FILES, "readwrite");
            const store = tx.objectStore(VirtualFS.STORE_FILES);
            const request = store.put(record);

            request.onsuccess = () => resolve(record);
            request.onerror = () => reject(request.error);
        });
    }

    async writeFile(filePath, content, mimeType = "application/octet-stream") {
        const norm = this.normalizePath(filePath);
        const parent = this.getParentPath(norm);
        const name = this.getName(norm);

        let size = 0;
        if (typeof content === "string") {
            size = new Blob([content]).size;
        } else if (content instanceof Blob) {
            size = content.size;
        } else if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
            size = content.byteLength;
        }

        const record = {
            path: norm,
            name: name,
            parent: parent,
            type: "file",
            mime: mimeType,
            size: size,
            updatedAt: Date.now(),
            content: content
        };

        if (!this.db) {
            this._memFiles.set(norm, record);
            return record;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_FILES, "readwrite");
            const store = tx.objectStore(VirtualFS.STORE_FILES);
            const request = store.put(record);

            request.onsuccess = () => resolve(record);
            request.onerror = () => reject(request.error);
        });
    }

    async readFile(filePath) {
        const norm = this.normalizePath(filePath);
        const record = await this.stat(norm);
        if (!record || record.type !== "file") {
            throw new Error(`Файл не найден: ${filePath}`);
        }
        return record.content;
    }

    async delete(targetPath) {
        const norm = this.normalizePath(targetPath);
        if (norm === "C:") throw new Error("Нельзя удалить корневой диск C:");

        // Рекурсивное удаление детей если это папка
        const children = await this.readdir(norm);
        for (const child of children) {
            await this.delete(child.path);
        }

        if (!this.db) {
            this._memFiles.delete(norm);
            return true;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_FILES, "readwrite");
            const store = tx.objectStore(VirtualFS.STORE_FILES);
            const request = store.delete(norm);

            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async rename(oldPath, newName) {
        const normOld = this.normalizePath(oldPath);
        const parent = this.getParentPath(normOld);
        const rawName = (newName.includes('/') || newName.includes('\\'))
            ? this.getName(newName)
            : newName;
        const cleanName = rawName.replace(/[\/\\:*?"<>|]/g, "").trim();
        const normNew = this.normalizePath(parent + "/" + cleanName);

        const oldRecord = await this.stat(normOld);
        if (!oldRecord) throw new Error("Элемент не найден: " + oldPath);

        const newRecord = {
            ...oldRecord,
            path: normNew,
            name: cleanName,
            parent: parent,
            updatedAt: Date.now()
        };

        // Записываем новый
        if (!this.db) {
            this._memFiles.delete(normOld);
            this._memFiles.set(normNew, newRecord);
        } else {
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(VirtualFS.STORE_FILES, "readwrite");
                const store = tx.objectStore(VirtualFS.STORE_FILES);
                store.delete(normOld);
                const req = store.put(newRecord);
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }

        // Если это была папка, обновляем пути детей
        if (oldRecord.type === "folder") {
            const children = await this.readdir(normOld);
            for (const child of children) {
                await this.rename(child.path, child.name);
            }
        }

        return newRecord;
    }

    /**
     * Экспорт файла из VFS на физический ПК пользователя через браузерный Blob-триггер
     */
    async exportFile(filePath) {
        if (typeof document === 'undefined') return;

        const record = await this.stat(filePath);
        if (!record || record.type !== 'file') return;

        let blob;
        if (record.content instanceof Blob) {
            blob = record.content;
        } else if (typeof record.content === 'string') {
            blob = new Blob([record.content], { type: record.mime || 'text/plain;charset=utf-8;' });
        } else {
            blob = new Blob([record.content], { type: record.mime || 'application/octet-stream' });
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = record.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Импорт реального файла с компьютера (Drag & Drop или Input) в целевую папку VFS
     */
    async importRealFile(realFile, targetDir = "C:/Загрузки") {
        const buffer = await realFile.arrayBuffer();
        const normDir = this.normalizePath(targetDir);
        const filePath = this.normalizePath(`${normDir}/${realFile.name}`);

        return await this.writeFile(filePath, buffer, realFile.type || "application/octet-stream");
    }
}
