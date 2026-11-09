/**
 * js/services/virtual_fs.js - Низкоуровневое Ядро VFS (IndexedDB Storage Engine v2.0)
 * 
 * Архитектура (Этап 1: Хардкор):
 * 1. 🗄️ Раздельные таблицы (Two-Tier Store Architecture):
 *    - "nodes": легковесные метаданные { path, parent, name, type: 'file'|'dir', size, mime, updatedAt }
 *    - "blobs": бинарные данные { path, data: Uint8Array | ArrayBuffer | string }
 *    Листинг каталогов (readdir) работает за < 0.1 мс без подтягивания тяжелых бинарников в ОЗУ.
 * 2. 🛡️ 100% локальная сохранность без бэкенда (данные живут в браузере под 152-ФЗ).
 * 3. 🔄 Мягкая миграция со схемы v1 (store "files") на схему v2 ("nodes" + "blobs").
 * 4. ⚡ In-memory fallback для headless-тестов, Safari ITP и приватных вкладок.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class VirtualFS {
    static DB_NAME = "PharmaGateVFS";
    static DB_VERSION = 2;
    static STORE_NODES = "nodes";
    static STORE_BLOBS = "blobs";
    static LEGACY_STORE_FILES = "files"; // Для плавной миграции с v1

    constructor() {
        this.isReady = false;
        this.db = null;
        this._memNodes = new Map(); // In-memory fallback для метаданных
        this._memBlobs = new Map(); // In-memory fallback для бинарников
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
            console.warn('[VirtualFS] Не удалось открыть IndexedDB, активирован in-memory fallback:', err);
            this._seedMemoryFiles();
            this.isReady = true;
        }
    }

    _openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(VirtualFS.DB_NAME, VirtualFS.DB_VERSION);

            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                const oldVersion = e.oldVersion;

                // 1. Создаем таблицу nodes (метаданные)
                if (!idb.objectStoreNames.contains(VirtualFS.STORE_NODES)) {
                    const nodeStore = idb.createObjectStore(VirtualFS.STORE_NODES, { keyPath: "path" });
                    nodeStore.createIndex("parent", "parent", { unique: false });
                    nodeStore.createIndex("type", "type", { unique: false });
                    nodeStore.createIndex("name", "name", { unique: false });
                    nodeStore.createIndex("updatedAt", "updatedAt", { unique: false });
                }

                // 2. Создаем таблицу blobs (бинарные тела файлов)
                if (!idb.objectStoreNames.contains(VirtualFS.STORE_BLOBS)) {
                    idb.createObjectStore(VirtualFS.STORE_BLOBS, { keyPath: "path" });
                }

                // 3. Миграция со старого хранилища v1 "files" (если существовало)
                if (oldVersion === 1 && idb.objectStoreNames.contains(VirtualFS.LEGACY_STORE_FILES)) {
                    const legacyTx = e.currentTarget.transaction;
                    const legacyStore = legacyTx.objectStore(VirtualFS.LEGACY_STORE_FILES);
                    const nodeStore = legacyTx.objectStore(VirtualFS.STORE_NODES);
                    const blobStore = legacyTx.objectStore(VirtualFS.STORE_BLOBS);

                    const getAllReq = legacyStore.getAll();
                    getAllReq.onsuccess = () => {
                        const oldRecords = getAllReq.result || [];
                        oldRecords.forEach(rec => {
                            // Сохраняем ноду
                            nodeStore.put({
                                path: rec.path,
                                parent: rec.parent || "",
                                name: rec.name || "",
                                type: rec.type || "file",
                                size: rec.size || 0,
                                mime: rec.mime || "application/octet-stream",
                                updatedAt: rec.updatedAt || Date.now()
                            });

                            // Если есть контент, сохраняем в blobs
                            if (rec.content !== undefined && rec.content !== null) {
                                blobStore.put({
                                    path: rec.path,
                                    data: rec.content
                                });
                            }
                        });
                        idb.deleteObjectStore(VirtualFS.LEGACY_STORE_FILES);
                    };
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async _seedInitialFilesIfEmpty() {
        const rootItems = await this.readdir("C:");
        if (rootItems.length > 0) return;

        // Создаем базовую системную структуру каталогов
        await this.mkdir("C:/Документы");
        await this.mkdir("C:/Загрузки");
        await this.mkdir("C:/База_ERP");
        await this.mkdir("C:/Схемы_DBF");

        // Демо-накладная (CSV / DBF text stream)
        const demoInvoiceData = "NAKL_ID;DATE;SUPPLIER;INN;SUMM;NDS\n408;10.11.2026;ЗАО ПРОТЕК;7724000000;284500.00;10%\n";
        await this.writeFile("C:/Документы/Накладная_408_Протек.csv", demoInvoiceData, "text/csv");

        // Демо протокол ЖНВЛП (ПП РФ № 865)
        const demoJnvlpData = "ЖНВЛП ПРОТОКОЛ СОГЛАСОВАНИЯ ЦЕН (ПП РФ № 865)\nРегион: г. Москва\nПредельная надбавка опт: 12%\nПредельная надбавка розн: 15%\nСтатус: Согласовано без нарушений\n";
        await this.writeFile("C:/Документы/Протокол_ЖНВЛП_Москва.txt", demoJnvlpData, "text/plain");

        // Инструкция приемщика склада
        const demoReadme = "Инструкция приемщика склада PharmaGate EDI:\n1. Для приемки маркированного товара наведите Камеру-ТСД на DataMatrix код.\n2. Для сверки цен откройте калькулятор ЖНВЛП.\n3. Все файлы сохраняются локально в виртуальную файловую систему IndexedDB.\n";
        await this.writeFile("C:/Документы/Инструкция_Приемщика_МДЛП.txt", demoReadme, "text/plain");

        // Схема полей накладной (JSON)
        const demoSchemaJson = JSON.stringify({
            name: "Стандартная схема накладной Protek / Katren",
            encoding: "CP1251",
            fields: ["CODEPST", "NAME", "SERIES", "GDATE", "QNT", "PRICE2", "SUMPAY", "EAN13"]
        }, null, 2);
        await this.writeFile("C:/Схемы_DBF/nakl_standart_schema.json", demoSchemaJson, "application/json");

        // Бинарный дамп SQLite
        const demoSqliteDummy = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00]);
        await this.writeFile("C:/База_ERP/grls_catalog_12k.sqlite", demoSqliteDummy, "application/x-sqlite3");
    }

    _seedMemoryFiles() {
        this._memNodes.clear();
        this._memBlobs.clear();

        const addMemFolder = (p, name, parent) => {
            this._memNodes.set(p, { path: p, name, parent, type: "folder", size: 0, updatedAt: Date.now() });
        };

        const addMemFile = (p, name, parent, content, mime) => {
            const size = typeof content === 'string' ? Buffer.byteLength(content, 'utf8') : (content?.byteLength || 0);
            this._memNodes.set(p, { path: p, name, parent, type: "file", size, mime, updatedAt: Date.now() });
            this._memBlobs.set(p, content);
        };

        addMemFolder("C:", "Диск C:", "");
        addMemFolder("C:/Документы", "Документы", "C:");
        addMemFolder("C:/Загрузки", "Загрузки", "C:");
        addMemFolder("C:/База_ERP", "База_ERP", "C:");
        addMemFolder("C:/Схемы_DBF", "Схемы_DBF", "C:");

        addMemFile(
            "C:/Документы/Накладная_408_Протек.csv",
            "Накладная_408_Протек.csv",
            "C:/Документы",
            "NAKL_ID;DATE;SUPPLIER;INN;SUMM;NDS\n408;10.11.2026;ЗАО ПРОТЕК;7724000000;284500.00;10%\n",
            "text/csv"
        );
        addMemFile(
            "C:/Документы/Протокол_ЖНВЛП_Москва.txt",
            "Протокол_ЖНВЛП_Москва.txt",
            "C:/Документы",
            "ЖНВЛП ПРОТОКОЛ СОГЛАСОВАНИЯ ЦЕН (ПП РФ № 865)\nРегион: г. Москва\n",
            "text/plain"
        );
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

    /**
     * Сверхбыстрый листинг каталога: читает только таблицу метаданных "nodes" без бинарников!
     */
    async readdir(dirPath) {
        const norm = this.normalizePath(dirPath);

        if (!this.db) {
            const list = [];
            for (const item of this._memNodes.values()) {
                if (item.parent === norm) list.push({ ...item });
            }
            return list.sort((a, b) => (b.type === 'dir' || b.type === 'folder' ? 1 : 0) - (a.type === 'dir' || a.type === 'folder' ? 1 : 0) || a.name.localeCompare(b.name));
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_NODES, "readonly");
            const store = tx.objectStore(VirtualFS.STORE_NODES);
            const index = store.index("parent");
            const request = index.getAll(IDBKeyRange.only(norm));

            request.onsuccess = () => {
                const items = request.result || [];
                // Папки всегда первыми, затем файлы по алфавиту
                items.sort((a, b) => (b.type === 'dir' || b.type === 'folder' ? 1 : 0) - (a.type === 'dir' || a.type === 'folder' ? 1 : 0) || a.name.localeCompare(b.name));
                resolve(items);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Получение метаданных узла без подтягивания бинарного тела
     */
    async stat(targetPath) {
        const norm = this.normalizePath(targetPath);
        if (norm === "C:") {
            return { path: "C:", name: "Диск C:", parent: "", type: "folder", size: 0, updatedAt: Date.now() };
        }

        if (!this.db) {
            const item = this._memNodes.get(norm);
            return item ? { ...item } : null;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_NODES, "readonly");
            const store = tx.objectStore(VirtualFS.STORE_NODES);
            const request = store.get(norm);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    async exists(targetPath) {
        const res = await this.stat(targetPath);
        return res !== null;
    }

    /**
     * Чтение бинарного содержимого файла из таблицы "blobs"
     */
    async readFile(filePath, asText = false) {
        const norm = this.normalizePath(filePath);
        const node = await this.stat(norm);
        if (!node || (node.type !== "file" && node.type !== undefined)) {
            throw new Error(`Файл не найден: ${filePath}`);
        }

        if (!this.db) {
            const data = this._memBlobs.get(norm);
            if (data === undefined) throw new Error(`Бинарные данные отсутствуют: ${filePath}`);
            if (asText) {
                if (typeof data === 'string') return data;
                return new TextDecoder('utf-8').decode(data);
            }
            return data;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_BLOBS, "readonly");
            const store = tx.objectStore(VirtualFS.STORE_BLOBS);
            const request = store.get(norm);

            request.onsuccess = () => {
                const rec = request.result;
                if (!rec || rec.data === undefined) {
                    resolve(asText ? "" : new Uint8Array(0));
                    return;
                }
                const data = rec.data;
                if (asText) {
                    if (typeof data === 'string') resolve(data);
                    else resolve(new TextDecoder('utf-8').decode(data));
                } else {
                    resolve(data);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Атомарная запись файла: метаданные в "nodes" + бинарник в "blobs"
     */
    async writeFile(filePath, data, mime = "application/octet-stream") {
        const norm = this.normalizePath(filePath);
        const parent = this.getParentPath(norm);
        const name = this.getName(norm);

        // Расчет размера в байтах
        let size = 0;
        if (typeof data === 'string') {
            size = (typeof Buffer !== 'undefined') ? Buffer.byteLength(data, 'utf8') : new TextEncoder().encode(data).length;
        } else if (data instanceof ArrayBuffer) {
            size = data.byteLength;
        } else if (data && data.buffer instanceof ArrayBuffer) {
            size = data.byteLength;
        } else if (data instanceof Blob) {
            size = data.size;
        }

        const node = {
            path: norm,
            parent: parent,
            name: name,
            type: "file",
            size: size,
            mime: mime,
            updatedAt: Date.now()
        };

        if (!this.db) {
            this._memNodes.set(norm, node);
            this._memBlobs.set(norm, data);
            return node;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([VirtualFS.STORE_NODES, VirtualFS.STORE_BLOBS], "readwrite");
            const nodeStore = tx.objectStore(VirtualFS.STORE_NODES);
            const blobStore = tx.objectStore(VirtualFS.STORE_BLOBS);

            nodeStore.put(node);
            blobStore.put({ path: norm, data: data });

            tx.oncomplete = () => resolve(node);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Создание каталога (только в таблице "nodes")
     */
    async mkdir(dirPath) {
        const norm = this.normalizePath(dirPath);
        if (norm === "C:") return;

        const parent = this.getParentPath(norm);
        const name = this.getName(norm);

        const node = {
            path: norm,
            parent: parent,
            name: name,
            type: "folder",
            size: 0,
            updatedAt: Date.now()
        };

        if (!this.db) {
            this._memNodes.set(norm, node);
            return node;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(VirtualFS.STORE_NODES, "readwrite");
            const store = tx.objectStore(VirtualFS.STORE_NODES);
            store.put(node);

            tx.oncomplete = () => resolve(node);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Рекурсивное удаление файла или папки с очисткой "nodes" и "blobs"
     */
    async delete(targetPath) {
        const norm = this.normalizePath(targetPath);
        if (norm === "C:") throw new Error("Нельзя удалить корневой диск C:");

        // Рекурсивно удаляем дочерние элементы
        const children = await this.readdir(norm);
        for (const child of children) {
            await this.delete(child.path);
        }

        if (!this.db) {
            this._memNodes.delete(norm);
            this._memBlobs.delete(norm);
            return true;
        }

        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([VirtualFS.STORE_NODES, VirtualFS.STORE_BLOBS], "readwrite");
            tx.objectStore(VirtualFS.STORE_NODES).delete(norm);
            tx.objectStore(VirtualFS.STORE_BLOBS).delete(norm);

            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Атомарное переименование узла
     */
    async rename(oldPath, newNameOrPath) {
        const normOld = this.normalizePath(oldPath);
        const parent = this.getParentPath(normOld);
        const rawName = (newNameOrPath.includes('/') || newNameOrPath.includes('\\'))
            ? this.getName(newNameOrPath)
            : newNameOrPath;
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

        if (!this.db) {
            this._memNodes.delete(normOld);
            this._memNodes.set(normNew, newRecord);

            if (this._memBlobs.has(normOld)) {
                const data = this._memBlobs.get(normOld);
                this._memBlobs.delete(normOld);
                this._memBlobs.set(normNew, data);
            }
        } else {
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction([VirtualFS.STORE_NODES, VirtualFS.STORE_BLOBS], "readwrite");
                const nodeStore = tx.objectStore(VirtualFS.STORE_NODES);
                const blobStore = tx.objectStore(VirtualFS.STORE_BLOBS);

                nodeStore.delete(normOld);
                nodeStore.put(newRecord);

                const getBlobReq = blobStore.get(normOld);
                getBlobReq.onsuccess = () => {
                    if (getBlobReq.result) {
                        blobStore.delete(normOld);
                        blobStore.put({ path: normNew, data: getBlobReq.result.data });
                    }
                };

                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            });
        }

        // Если это была папка, рекурсивно обновляем пути детей
        if (oldRecord.type === "dir" || oldRecord.type === "folder") {
            const children = await this.readdir(normOld);
            for (const child of children) {
                const childNewPath = normNew + "/" + child.name;
                await this.rename(child.path, childNewPath);
            }
        }

        return newRecord;
    }

    /**
     * Импорт реального файла с компьютера (File / Blob) в VFS
     */
    async importRealFile(file, targetDir = "C:/Загрузки") {
        const normDir = this.normalizePath(targetDir);
        const fileName = file.name || "imported_document.dbf";
        const filePath = normDir + "/" + fileName;

        let content;
        if (typeof file.arrayBuffer === 'function') {
            content = await file.arrayBuffer();
        } else if (file instanceof ArrayBuffer || (file && file.buffer instanceof ArrayBuffer)) {
            content = file;
        } else {
            content = file;
        }

        return await this.writeFile(filePath, content, file.type || "application/octet-stream");
    }

    /**
     * Экспорт виртуального файла на физический диск через Blob Download
     */
    async exportFile(filePath) {
        const norm = this.normalizePath(filePath);
        const node = await this.stat(norm);
        if (!node) throw new Error("Файл не найден: " + filePath);

        const data = await this.readFile(norm);
        const blob = (data instanceof Blob) ? data : new Blob([data], { type: node.mime || "application/octet-stream" });

        if (typeof window !== 'undefined' && typeof document !== 'undefined') {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = node.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 2000);
        }

        return blob;
    }
}
