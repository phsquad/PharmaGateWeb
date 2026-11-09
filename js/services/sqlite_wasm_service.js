/**
 * js/services/sqlite_wasm_service.js - Автономная реляционная СУБД Mini-ERP в браузере на базе SQLite WASM (sql.js).
 * 
 * Обеспечивает:
 * - Локальный учет номенклатуры с O(1) индексами по EAN-13, GTIN и артикулам;
 * - Журнал проведенных накладных с защитой от повторного проведения по SHA-256;
 * - Журнал дефектуры и недопоставок (defectura_log);
 * - Аналитику динамики закупочных цен и расчет наценок.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { EncodingGuard } from '../engine/text_engine.js';

export class SQLiteWasmService {
    static db = null;
    static SQL = null;
    static isInitialized = false;

    /**
     * Инициализация движка SQLite WASM и создание реляционных таблиц
     */
    static async initDatabase() {
        if (this.db) return this.db;

        try {
            if (typeof window !== 'undefined' && window.initSqlJs) {
                this.SQL = await window.initSqlJs({
                    locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                
                // Проверяем сохраненную базу в IndexedDB или создаем новую
                const savedDbBuffer = await this._loadDatabaseFromIndexedDB();
                if (savedDbBuffer) {
                    this.db = new this.SQL.Database(new Uint8Array(savedDbBuffer));
                    console.log("[SQLiteWasmService] Локальная база Mini-ERP успешно восстановлена из хранилища.");
                } else {
                    this.db = new this.SQL.Database();
                    console.log("[SQLiteWasmService] Создана новая чистая реляционная база Mini-ERP.");
                }

                this._createTables();
                this.isInitialized = true;
                return this.db;
            } else {
                console.warn("[SQLiteWasmService] Библиотека sql.js не подключена. Активирован локальный in-memory режим.");
                this._initInMemoryFallback();
                this.isInitialized = true;
                return this.db;
            }
        } catch (error) {
            console.warn("[SQLiteWasmService] Сбой инициализации SQLite WASM, активирован локальный in-memory режим:", error);
            this._initInMemoryFallback();
            this.isInitialized = true;
            return this.db;
        }
    }

    /**
     * Локальный in-memory дублер на случай блокировки CDN или отсутствия WASM
     * @private
     */
    static _initInMemoryFallback() {
        const memoryProducts = new Map();
        const memoryDefectura = [];
        this.db = {
            run: () => {},
            prepare: (sql) => {
                let currentRows = [];
                let cursor = 0;
                return {
                    bind: (params = []) => {
                        if (sql.includes('SELECT * FROM products WHERE ean13 = ?')) {
                            const ean = params[0];
                            const found = Array.from(memoryProducts.values()).find(p => p.ean13 === ean);
                            currentRows = found ? [found] : [];
                        } else if (sql.includes('SELECT * FROM products WHERE codepst = ?')) {
                            const code = params[0];
                            const found = memoryProducts.get(code);
                            currentRows = found ? [found] : [];
                        } else if (sql.includes('SELECT COUNT(*) AS total FROM products')) {
                            const q = (params[0] || '').replace(/%/g, '').toLowerCase();
                            const total = Array.from(memoryProducts.values()).filter(p =>
                                !q || (p.name && p.name.toLowerCase().includes(q)) || (p.codepst && p.codepst.toLowerCase().includes(q))
                            ).length;
                            currentRows = [{ total }];
                        } else if (sql.includes('SELECT * FROM products')) {
                            const q = (params[0] || '').replace(/%/g, '').toLowerCase();
                            const limit = params[4] || 50;
                            const offset = params[5] || 0;
                            const filtered = Array.from(memoryProducts.values()).filter(p =>
                                !q || (p.name && p.name.toLowerCase().includes(q)) || (p.codepst && p.codepst.toLowerCase().includes(q))
                            ).slice(offset, offset + limit);
                            currentRows = filtered;
                        }
                        cursor = 0;
                    },
                    step: () => cursor < currentRows.length,
                    getAsObject: () => currentRows[cursor++] || {},
                    run: (params) => {
                        if (sql.includes('INSERT INTO products')) {
                            const [codepst, name, ean13, gtin, cntr, firm, nds, regprc, numgtd] = params;
                            memoryProducts.set(codepst, { codepst, name, ean13, gtin, cntr, firm, nds, regprc, numgtd });
                        } else if (sql.includes('INSERT INTO defectura_log')) {
                            const [codepst, name, refused_qnt, order_price, refusal_sum, podrcd, doc_ndoc, refusal_date] = params;
                            memoryDefectura.push({ codepst, name, refused_qnt, order_price, refusal_sum, podrcd, doc_ndoc, refusal_date });
                        }
                    },
                    free: () => {}
                };
            },
            export: () => new Uint8Array([]),
            exec: (sql) => {
                const prods = Array.from(memoryProducts.values());
                return [{
                    columns: ['codepst', 'name', 'ean13', 'regprc', 'firm', 'cntr'],
                    values: prods.map(p => [p.codepst, p.name, p.ean13 || '', p.regprc || 0, p.firm || '', p.cntr || ''])
                }];
            }
        };
    }

    /**
     * Создание таблиц и высокопроизводительных индексов
     * @private
     */
    static _createTables() {
        if (!this.db) return;

        this.db.run(`
            -- 1. Справочник номенклатуры
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codepst TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                ean13 TEXT,
                gtin TEXT,
                cntr TEXT DEFAULT 'Россия',
                firm TEXT DEFAULT '-',
                nds INTEGER DEFAULT 10,
                regprc REAL DEFAULT 0.00,
                numgtd TEXT DEFAULT 'б/гтд',
                sertif TEXT DEFAULT '-',
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- 2. Журнал проведенных документов
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                doc_type TEXT NOT NULL,
                ndoc TEXT NOT NULL,
                datedoc DATE NOT NULL,
                network_key TEXT NOT NULL,
                podrcd TEXT NOT NULL,
                total_sum REAL DEFAULT 0.00,
                total_nds REAL DEFAULT 0.00,
                total_qnt REAL DEFAULT 0.00,
                status TEXT DEFAULT 'PROCESSED',
                sha256_hash TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- 3. Строки спецификаций документов
            CREATE TABLE IF NOT EXISTS document_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                codepst TEXT NOT NULL,
                name TEXT NOT NULL,
                ser TEXT DEFAULT 'б/с',
                gdate DATE,
                datemade DATE,
                qnt REAL NOT NULL,
                price1 REAL DEFAULT 0.00,
                price2 REAL NOT NULL,
                price2n REAL NOT NULL,
                sumstr REAL NOT NULL,
                sumsnds REAL NOT NULL,
                nds INTEGER DEFAULT 10,
                ean13 TEXT,
                gtin TEXT,
                FOREIGN KEY(document_id) REFERENCES documents(id) ON DELETE CASCADE
            );

            -- 4. Журнал дефектуры и отказов
            CREATE TABLE IF NOT EXISTS defectura_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                codepst TEXT NOT NULL,
                name TEXT NOT NULL,
                refused_qnt REAL NOT NULL,
                order_price REAL NOT NULL,
                refusal_sum REAL NOT NULL,
                podrcd TEXT NOT NULL,
                doc_ndoc TEXT,
                refusal_date DATE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Высокоскоростные индексы для O(1) поиска
            CREATE INDEX IF NOT EXISTS idx_products_ean13 ON products(ean13);
            CREATE INDEX IF NOT EXISTS idx_products_codepst ON products(codepst);
            CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
            CREATE INDEX IF NOT EXISTS idx_items_codepst ON document_items(codepst);
            CREATE INDEX IF NOT EXISTS idx_docs_hash ON documents(sha256_hash);
        `);
    }

    /**
     * Пакетная вставка или обновление товаров номенклатуры в одной транзакции
     * @param {Array<Object>} records 
     * @returns {number}
     */
    static bulkInsertProducts(records) {
        if (!this.db || !records || records.length === 0) return 0;

        let insertedCount = 0;
        this.db.run("BEGIN TRANSACTION;");

        const stmt = this.db.prepare(`
            INSERT INTO products (codepst, name, ean13, gtin, cntr, firm, nds, regprc, numgtd)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(codepst) DO UPDATE SET
                name = excluded.name,
                ean13 = COALESCE(NULLIF(excluded.ean13, ''), products.ean13),
                gtin = COALESCE(NULLIF(excluded.gtin, ''), products.gtin),
                cntr = COALESCE(NULLIF(excluded.cntr, ''), products.cntr),
                firm = COALESCE(NULLIF(excluded.firm, ''), products.firm),
                nds = excluded.nds,
                regprc = CASE WHEN excluded.regprc > 0 THEN excluded.regprc ELSE products.regprc END,
                updated_at = CURRENT_TIMESTAMP;
        `);

        records.forEach(r => {
            const codepst = EncodingGuard.sanitizeCodepstProtek(r.CODEPST || r.codepst);
            const name = EncodingGuard.sanitizeText366(r.NAME || r.name);

            if (codepst && name && name.length >= 2) {
                stmt.run([
                    codepst,
                    name,
                    String(r.EAN13 || r.ean13 || '').trim(),
                    String(r.GTIN || r.gtin || '').trim(),
                    EncodingGuard.sanitizeText366(r.CNTR || r.cntr || 'Россия'),
                    EncodingGuard.sanitizeText366(r.FIRM || r.firm || '-'),
                    parseInt(r.NDS || r.nds || 10, 10),
                    PharmaMath.cleanDecimal(r.REGPRC || r.regprc, 0.0),
                    String(r.NUMGTD || r.numgtd || 'б/гтд').trim()
                ]);
                insertedCount++;
            }
        });

        stmt.free();
        this.db.run("COMMIT;");
        this._autoSaveDatabase();

        return insertedCount;
    }

    /**
     * Мгновенный O(1) поиск препарата по штрихкоду EAN-13
     * @param {string} ean13 
     * @returns {Object|null}
     */
    static lookupByEan13(ean13) {
        if (!this.db || !ean13) return null;
        const cleanEan = String(ean13).replace(/\D/g, '').padStart(13, '0').slice(-13);

        const stmt = this.db.prepare("SELECT * FROM products WHERE ean13 = ? LIMIT 1;");
        stmt.bind([cleanEan]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }

        stmt.free();
        return null;
    }

    /**
     * Мгновенный O(1) поиск препарата по артикулу
     * @param {string} codepst 
     * @returns {Object|null}
     */
    static lookupByCode(codepst) {
        if (!this.db || !codepst) return null;
        const cleanCode = EncodingGuard.sanitizeCodepstProtek(codepst);

        const stmt = this.db.prepare("SELECT * FROM products WHERE codepst = ? LIMIT 1;");
        stmt.bind([cleanCode]);

        if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
        }

        stmt.free();
        return null;
    }

    /**
     * Постраничный поиск номенклатуры для таблиц интерфейса
     * @param {string} query 
     * @param {number} limit 
     * @param {number} offset 
     * @returns {{ records: Array<Object>, totalCount: number }}
     */
    static searchProductsPaginated(query = "", limit = 50, offset = 0) {
        if (!this.db) return { records: [], totalCount: 0 };

        const cleanQ = `%${String(query || '').trim()}%`;

        const countStmt = this.db.prepare(`
            SELECT COUNT(*) AS total FROM products 
            WHERE codepst LIKE ? OR name LIKE ? OR ean13 LIKE ? OR gtin LIKE ?;
        `);
        countStmt.bind([cleanQ, cleanQ, cleanQ, cleanQ]);
        countStmt.step();
        const totalCount = countStmt.getAsObject().total || 0;
        countStmt.free();

        const dataStmt = this.db.prepare(`
            SELECT * FROM products 
            WHERE codepst LIKE ? OR name LIKE ? OR ean13 LIKE ? OR gtin LIKE ?
            ORDER BY name ASC LIMIT ? OFFSET ?;
        `);
        dataStmt.bind([cleanQ, cleanQ, cleanQ, cleanQ, limit, offset]);

        const records = [];
        while (dataStmt.step()) {
            records.push(dataStmt.getAsObject());
        }
        dataStmt.free();

        return { records, totalCount };
    }

    /**
     * Запись позиций отказа в журнал дефектуры
     * @param {Array<Object>} otkazRecords 
     * @param {string} docNdoc 
     * @param {string} podrcd 
     */
    static logDefectura(otkazRecords, docNdoc = "1", podrcd = "001") {
        if (!this.db || !otkazRecords || otkazRecords.length === 0) return 0;

        let inserted = 0;
        const todayIso = new Date().toISOString().split('T')[0];
        this.db.run("BEGIN TRANSACTION;");

        const stmt = this.db.prepare(`
            INSERT INTO defectura_log (codepst, name, refused_qnt, order_price, refusal_sum, podrcd, doc_ndoc, refusal_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `);

        otkazRecords.forEach(r => {
            const code = EncodingGuard.sanitizeCodepstProtek(r.CODEPST);
            const name = EncodingGuard.sanitizeText366(r.NAME || `Товар ${code}`);
            const qnt = PharmaMath.cleanDecimal(r.QNT, 1.0);
            const price = PharmaMath.cleanDecimal(r.PRICE, 0.0);
            const sum = PharmaMath.roundMoney(qnt * price);

            stmt.run([code, name, qnt, price, sum, String(podrcd).trim(), String(docNdoc).trim(), todayIso]);
            inserted++;
        });

        stmt.free();
        this.db.run("COMMIT;");
        this._autoSaveDatabase();

        return inserted;
    }

    /**
     * Автоматическое сохранение снимка базы в IndexedDB
     * @private
     */
    static async _autoSaveDatabase() {
        if (!this.db || typeof indexedDB === 'undefined') return;
        try {
            const binaryArray = this.db.export();
            await this._saveDatabaseToIndexedDB(binaryArray.buffer);
        } catch (e) {
            console.warn("[SQLiteWasmService] Не удалось автосохранить базу в IndexedDB:", e);
        }
    }

    static _openIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("PharmaGateErpStorage", 1);
            request.onupgradeneeded = (e) => {
                const idb = e.target.result;
                if (!idb.objectStoreNames.contains("databases")) {
                    idb.createObjectStore("databases");
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    static async _saveDatabaseToIndexedDB(arrayBuffer) {
        const idb = await this._openIndexedDB();
        return new Promise((resolve, reject) => {
            const tx = idb.transaction("databases", "readwrite");
            const store = tx.objectStore("databases");
            store.put(arrayBuffer, "main_erp_db");
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    static async _loadDatabaseFromIndexedDB() {
        try {
            const idb = await this._openIndexedDB();
            return new Promise((resolve, reject) => {
                const tx = idb.transaction("databases", "readonly");
                const store = tx.objectStore("databases");
                const req = store.get("main_erp_db");
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error);
            });
        } catch (e) {
            return null;
        }
    }

    /**
     * Предустановленные шаблоны аналитических SQL-запросов
     */
    static SQL_PRESETS = [
        {
            name: "Все товары номенклатуры (Top 100)",
            sql: "SELECT id, codepst AS 'Код', name AS 'Наименование', ean13 AS 'Штрихкод', regprc AS 'Реестр. цена', firm AS 'Производитель' FROM products ORDER BY id DESC LIMIT 100;"
        },
        {
            name: "Группировка по производителям",
            sql: "SELECT firm AS 'Производитель', COUNT(*) AS 'Позиций', ROUND(AVG(regprc), 2) AS 'Средняя реестр. цена' FROM products GROUP BY firm HAVING COUNT(*) >= 1 ORDER BY 2 DESC LIMIT 50;"
        },
        {
            name: "Дорогие позиции (> 500 ₽)",
            sql: "SELECT codepst AS 'Код', name AS 'Наименование', regprc AS 'Цена', firm AS 'Производитель' FROM products WHERE regprc > 500 ORDER BY regprc DESC;"
        },
        {
            name: "Распределение по странам",
            sql: "SELECT cntr AS 'Страна', COUNT(*) AS 'Кол-во товаров' FROM products GROUP BY cntr ORDER BY 2 DESC;"
        },
        {
            name: "Журнал отказов и дефектуры",
            sql: "SELECT id, codepst AS 'Код', name AS 'Наименование', refused_qnt AS 'Отказано шт.', refusal_sum AS 'Сумма отказа', refusal_date AS 'Дата' FROM defectura_log ORDER BY id DESC LIMIT 100;"
        },
        {
            name: "Сводка по проведенным накладным",
            sql: "SELECT id, doc_type AS 'Тип', ndoc AS '№ Накладной', datedoc AS 'Дата', podrcd AS 'Склад', total_sum AS 'Сумма с НДС', total_nds AS 'Сумма НДС', total_qnt AS 'Кол-во шт.' FROM documents ORDER BY id DESC;"
        }
    ];

    /**
     * Выполнение произвольного SQL запроса пользователя (SQL Консоль)
     * @param {string} sqlQuery
     * @returns {{ success: boolean, columns: string[], rows: any[][], rowCount: number, executionTimeMs: number, error?: string, message?: string }}
     */
    static executeUserQuery(sqlQuery) {
        if (!sqlQuery || !sqlQuery.trim()) {
            return {
                success: false,
                columns: [],
                rows: [],
                rowCount: 0,
                executionTimeMs: 0,
                error: "Текст SQL запроса пуст."
            };
        }

        const startTime = performance.now();
        try {
            if (!this.db) {
                throw new Error("База данных SQLite не инициализирована.");
            }

            const cleanSql = sqlQuery.trim();
            if (typeof this.db.exec === 'function') {
                const results = this.db.exec(cleanSql);
                const executionTimeMs = PharmaMath.cleanDecimal(performance.now() - startTime, 0.0);

                if (results && results.length > 0) {
                    const lastResult = results[results.length - 1];
                    return {
                        success: true,
                        columns: lastResult.columns || [],
                        rows: lastResult.values || [],
                        rowCount: (lastResult.values && lastResult.values.length) || 0,
                        executionTimeMs,
                        message: `Успешно возвращено строк: ${lastResult.values ? lastResult.values.length : 0} (${executionTimeMs} мс)`
                    };
                } else {
                    return {
                        success: true,
                        columns: [],
                        rows: [],
                        rowCount: 0,
                        executionTimeMs,
                        message: `Запрос успешно выполнен за ${executionTimeMs} мс (без возврата записей)`
                    };
                }
            } else if (typeof this.db.run === 'function') {
                this.db.run(cleanSql);
                const executionTimeMs = PharmaMath.cleanDecimal(performance.now() - startTime, 0.0);
                return {
                    success: true,
                    columns: [],
                    rows: [],
                    rowCount: 0,
                    executionTimeMs,
                    message: `Запрос выполнен за ${executionTimeMs} мс`
                };
            } else {
                throw new Error("Текущий драйвер БД не поддерживает метод exec/run");
            }
        } catch (err) {
            const executionTimeMs = PharmaMath.cleanDecimal(performance.now() - startTime, 0.0);
            return {
                success: false,
                columns: [],
                rows: [],
                rowCount: 0,
                executionTimeMs,
                error: err.message || String(err)
            };
        }
    }
}
