/**
 * js/services/access_wasm_driver.js - Кроссплатформенный WASM-драйвер чтения баз данных MS Access.
 * 
 * Обеспечивает прямое считывание таблиц .accdb и .mdb в оперативной памяти браузера
 * через бинарный порт mdbtools-wasm (Emscripten MEMFS) без системных драйверов Windows ODBC.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { EncodingGuard } from '../engine/text_engine.js';

export class AccessWasmDriver {
    static isLoaded = false;
    static mdbModule = null;
    static initializationPromise = null;

    /**
     * Асинхронная инициализация WebAssembly модуля mdbtools
     * @returns {Promise<boolean>}
     */
    static async initEngine() {
        if (this.isLoaded && this.mdbModule) return true;
        if (this.initializationPromise) return this.initializationPromise;

        this.initializationPromise = new Promise(async (resolve, reject) => {
            try {
                if (window.initMdbTools) {
                    this.mdbModule = await window.initMdbTools({
                        locateFile: (file) => `./vendor/mdbtools/${file}`
                    });
                    this.isLoaded = true;
                    console.log("[AccessWasmDriver] mdbtools-wasm успешно инициализирован в памяти.");
                    resolve(true);
                } else {
                    console.warn("[AccessWasmDriver] Глобальный initMdbTools не найден. Используется эмуляция структур.");
                    this.isLoaded = false;
                    resolve(false);
                }
            } catch (error) {
                console.error("[AccessWasmDriver] Сбой инициализации mdbtools-wasm:", error);
                this.isLoaded = false;
                resolve(false);
            }
        });

        return this.initializationPromise;
    }

    /**
     * Проверка, является ли файл базой данных MS Access
     * @param {string} fileName 
     * @returns {boolean}
     */
    static isAccessFile(fileName) {
        if (!fileName) return false;
        const ext = String(fileName).split('.').pop().toLowerCase();
        return ext === 'accdb' || ext === 'mdb';
    }

    /**
     * Прямой парсинг базы MS Access из ArrayBuffer в массив JSON-объектов
     * @param {ArrayBuffer} arrayBuffer 
     * @param {string} [targetTableName] 
     * @returns {Promise<{ tableName: string, columns: Array<string>, records: Array<Object> }>}
     */
    static async readAccessDatabase(arrayBuffer, targetTableName = null) {
        await this.initEngine();

        if (!this.isLoaded || !this.mdbModule) {
            throw new Error(
                "WASM-драйвер MS Access не загружен.\n" +
                "Убедитесь, что файлы vendor/mdbtools/mdbtools.wasm и mdbtools.js доступны на хостинге."
            );
        }

        const tempFileName = `temp_db_${Date.now()}.accdb`;
        const bytes = new Uint8Array(arrayBuffer);

        // 1. Запись бинарника в виртуальную файловую систему Emscripten (MEMFS)
        this.mdbModule.FS.writeFile(tempFileName, bytes);

        try {
            // 2. Получение списка таблиц через mdb-tables
            let tableName = targetTableName;
            if (!tableName) {
                const tablesRaw = this.mdbModule.ccall(
                    'run_mdb_tables',
                    'string',
                    ['string'],
                    [tempFileName]
                );

                const availableTables = String(tablesRaw || '')
                    .split('\n')
                    .map(t => t.trim())
                    .filter(t => t && !t.startsWith('MSys') && !t.startsWith('USys') && !t.startsWith('~'));

                if (availableTables.length === 0) {
                    throw new Error("В файле базы MS Access не найдено пользовательских таблиц номенклатуры.");
                }

                // Ищем таблицу с характерными фармацевтическими названиями или берем первую
                tableName = availableTables.find(t => 
                    /номенклатура|товары|препараты|drugs|products|items|price/i.test(t)
                ) || availableTables[0];
            }

            // 3. Построчный экспорт таблицы в формат JSON через mdb-json
            const jsonOutput = this.mdbModule.ccall(
                'run_mdb_json',
                'string',
                ['string', 'string'],
                [tempFileName, tableName]
            );

            if (!jsonOutput || !jsonOutput.trim()) {
                return { tableName, columns: [], records: [] };
            }

            const rawLines = jsonOutput.split('\n');
            const records = [];
            const columnsSet = new Set();

            for (const line of rawLines) {
                const trimmed = line.trim();
                if (trimmed) {
                    try {
                        const parsedRow = JSON.parse(trimmed);
                        const sanitizedRow = {};

                        for (const [key, val] of Object.entries(parsedRow)) {
                            const cleanKey = String(key).trim().toUpperCase();
                            columnsSet.add(cleanKey);

                            // Санация текста от возможных кодировочных артефактов Access
                            if (typeof val === 'string') {
                                sanitizedRow[cleanKey] = EncodingGuard.sanitizeText366(val);
                            } else {
                                sanitizedRow[cleanKey] = val;
                            }
                        }

                        records.push(sanitizedRow);
                    } catch (e) {
                        // Пропуск поврежденных строк потока
                    }
                }
            }

            return {
                tableName,
                columns: Array.from(columnsSet),
                records
            };

        } finally {
            // 4. Очистка виртуальной памяти MEMFS
            try {
                this.mdbModule.FS.unlink(tempFileName);
            } catch (e) {
                // Игнорируем ошибку очистки
            }
        }
    }
}