/**
 * js/domain/flk_engine.js - 10-пассовый конвейер автоматического ремонта накладных (RulesEngine 99%).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { EncodingGuard } from '../engine/text_engine.js';
import { PharmaMath, GS1BarcodeValidator } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { ValidationIssue } from './models.js';
import { ProfileManager } from './network_profiles.js';
import { PharmaVocabulary } from './pharma_vocab.js';

export class FLKEngine {
    static RU_REG_PATTERNS = /^(?:рзн|фср|фс|ру)\s*№?\s*[а-яА-Я0-9/]+/i;
    static DUMMY_SERIES = /^(?:000000|123456|тест|test|xxxxx|000|---|null|none)$/i;

    /**
     * Валидация массива строк накладной по правилам ФЛК
     * @param {Object} schema 
     * @param {Array<Object>} records 
     * @param {string} profileKey 
     * @returns {Array<ValidationIssue>}
     */
    static validateDocument(schema, records, profileKey = "neofarm") {
        const issues = [];
        if (!records || records.length === 0) {
            issues.push(new ValidationIssue("CRITICAL", "GLOBAL", 0, "Документ пуст: нет строк номенклатуры!", "EMPTY_DOC", "ERR_EMPTY_DOCUMENT", false));
            return issues;
        }

        const profile = ProfileManager.getProfile(profileKey);
        const firstRow = records[0];
        const masterDate = DateEngine.parseAnyDate(firstRow.DATEDOC);
        const masterNdoc = String(firstRow.NDOC || '').trim();
        const masterPodrcd = String(firstRow.PODRCD || '').trim();
        const seenCombos = new Map();

        records.forEach((rec, idx) => {
            const rowNum = idx + 1;
            const codepst = String(rec.CODEPST || '').trim();
            const ser = String(rec.SER || '').trim().toUpperCase();
            const name = String(rec.NAME || '').trim();

            const qnt = PharmaMath.cleanDecimal(rec.QNT);
            const p1 = PharmaMath.cleanDecimal(rec.PRICE1);
            const p2 = PharmaMath.cleanDecimal(rec.PRICE2);
            const p2n = PharmaMath.cleanDecimal(rec.PRICE2N);
            const sumstr = PharmaMath.cleanDecimal(rec.SUMSTR);
            const gDate = DateEngine.parseAnyDate(rec.GDATE);
            const dMade = DateEngine.parseAnyDate(rec.DATEMADE);

            // 1. Проверка синхронизации шапки
            if (masterDate && DateEngine.parseAnyDate(rec.DATEDOC) !== masterDate) {
                issues.push(new ValidationIssue("CRITICAL", "DATEDOC", rowNum, `Рассинхронизация даты накладной в строке ${rowNum}`, "HEADER_DESYNC", "ERR_HEADER_DESYNC", true));
            }
            if (masterNdoc && String(rec.NDOC || '').trim() !== masterNdoc) {
                issues.push(new ValidationIssue("CRITICAL", "NDOC", rowNum, `Рассинхронизация номера накладной в строке ${rowNum}`, "HEADER_DESYNC", "ERR_HEADER_DESYNC", true));
            }
            if (masterPodrcd && String(rec.PODRCD || '').trim() !== masterPodrcd) {
                issues.push(new ValidationIssue("CRITICAL", "PODRCD", rowNum, `Рассинхронизация кода аптеки в строке ${rowNum}`, "HEADER_DESYNC", "ERR_HEADER_DESYNC", true));
            }

            // 2. Дубликаты строк (CODEPST + SER)
            if (codepst && ser && ser !== "Б/С") {
                const comboKey = `${codepst}_${ser}`;
                if (seenCombos.has(comboKey)) {
                    issues.push(new ValidationIssue("CRITICAL", "CODEPST", rowNum, `Дубликат позиции: артикул '${codepst}' с серией '${ser}' уже в строке ${seenCombos.get(comboKey)}`, "DUPLICATE_ITEM", "ERR_DUPLICATE_ROW", false));
                } else {
                    seenCombos.set(comboKey, rowNum);
                }
            }

            // 3. Числовые и финансовые проверки
            if (qnt <= 0) {
                issues.push(new ValidationIssue("CRITICAL", "QNT", rowNum, `Нулевое или отрицательное количество (${qnt})`, "ZERO_QNT", "ERR_INVALID_QUANTITY", false));
            }
            if (qnt > 0 && p2 <= 0) {
                issues.push(new ValidationIssue("CRITICAL", "PRICE2", rowNum, `Нулевая цена при наличии количества товара`, "ZERO_PRICE", "ERR_ZERO_PRICE", false));
            }
            if (qnt > 0 && p2 > 0) {
                const expectedSum = PharmaMath.roundMoney(qnt * p2);
                if (Math.abs(expectedSum - sumstr) > 0.0) {
                    issues.push(new ValidationIssue("WARNING", "SUMSTR", rowNum, `Расхождение сумм: расчет QNT*PRICE2 = ${expectedSum.toFixed(2)}, в файле = ${sumstr.toFixed(2)}`, "MATH_MISMATCH", "ERR_MATH_BALANCE", true));
                }
            }

            // 4. Сроки годности
            if (!gDate) {
                issues.push(new ValidationIssue("CRITICAL", "GDATE", rowNum, `Не указан или поврежден срок годности`, "EMPTY_GDATE", "ERR_REQUIRED_FIELD_EMPTY", false));
            } else {
                const daysLeft = DateEngine.getDaysLeft(gDate);
                if (daysLeft <= 0) {
                    issues.push(new ValidationIssue("CRITICAL", "GDATE", rowNum, `Просроченный препарат! Срок истёк (${DateEngine.formatForUI(gDate)})`, "EXPIRED", "ERR_EXPIRED_DRUG", false));
                } else if (daysLeft < 90) {
                    issues.push(new ValidationIssue("WARNING", "GDATE", rowNum, `Критический остаточный срок (< 90 дн.): осталось ${daysLeft} дн.`, "SHORT_SHELF_LIFE", "ERR_SHORT_SHELF_LIFE", true));
                }
                if (dMade && new Date(dMade) >= new Date(gDate)) {
                    issues.push(new ValidationIssue("CRITICAL", "DATEMADE", rowNum, `Дата выпуска (${DateEngine.formatForUI(dMade)}) позже или равна сроку годности (${DateEngine.formatForUI(gDate)})`, "DATE_ANOMALY", "ERR_DATEMADE_AFTER_GDATE", false));
                }
            }

            // 5. Штрихкод EAN-13
            if (rec.EAN13) {
                const eanStr = String(rec.EAN13).trim();
                if (!GS1BarcodeValidator.validateEan13(eanStr)) {
                    issues.push(new ValidationIssue("WARNING", "EAN13", rowNum, `Некорректная контрольная сумма EAN-13 (${eanStr})`, "INVALID_EAN", "ERR_INVALID_EAN13", true));
                }
            }

            // 6. Правила Триады Катрена
            if (profile.requireTriad) {
                if (!ser || this.DUMMY_SERIES.test(ser)) {
                    issues.push(new ValidationIssue("CRITICAL", "SER", rowNum, `Катрен: Не указана обязательная заводская серия (SER)`, "KATREN_TRIAD", "ERR_KATREN_SER_MISSING", true));
                }
                if (p1 <= 0) {
                    issues.push(new ValidationIssue("CRITICAL", "PRICE1", rowNum, `Катрен: Не указана обязательная цена производителя (PRICE1)`, "KATREN_TRIAD", "ERR_KATREN_PRICE1_MISSING", true));
                }
            }

            // 7. Правила НЕО-ФАРМ (SUBJID)
            if (profile.cleanSubjidGuid && rec.SUBJID && String(rec.SUBJID).includes('00000000')) {
                issues.push(new ValidationIssue("CRITICAL", "SUBJID", rowNum, `НЕО-ФАРМ: Фиктивный нулевой GUID в SUBJID. Требуется пустое поле при отсутствии МДЛП.`, "NEOFARM_SUBJID", "ERR_MDLP_SUBJID_GUID", true));
            }

            // 8. ГТД для товаров РФ
            const isRussia = PharmaVocabulary.normalizeCountry(rec.CNTR) === "Россия";
            const gtd = String(rec.NUMGTD || '').trim();
            if (isRussia && gtd && gtd.toLowerCase() !== 'б/гтд' && this.RU_REG_PATTERNS.test(gtd)) {
                issues.push(new ValidationIssue("WARNING", "NUMGTD", rowNum, `Номер РУ ('${gtd}') в поле ГТД для товара РФ. Должно стоять 'б/гтд'.`, "GTD_RU_MISMATCH", "ERR_GTD_VS_RU_CLASSIFICATION", true));
            }

            // 9. Обязательные поля
            if (!name) {
                issues.push(new ValidationIssue("CRITICAL", "NAME", rowNum, `Не заполнено обязательное наименование медикамента`, "EMPTY_NAME", "ERR_REQUIRED_FIELD_EMPTY", false));
            }
        });

        return issues;
    }

    /**
     * Расчет индекса готовности документа (0 - 100%)
     */
    static calculateReadinessScore(issues, recordsCount = 1) {
        const criticals = issues.filter(i => i.severity === 'CRITICAL');
        const warnings = issues.filter(i => i.severity === 'WARNING');

        let score = 100;
        if (criticals.length > 0) {
            score = Math.max(0, 100 - (criticals.length * 25) - (warnings.length * 5));
        } else if (warnings.length > 0) {
            score = Math.max(50, 100 - (warnings.length * 5));
        }

        let status = 'GREEN';
        let statusText = '🟢 100% ГОТОВ К ОТПРАВКЕ';

        if (criticals.length > 0) {
            status = 'RED';
            statusText = '🔴 БЛОКИРОВКА ПРИЁМКИ';
        } else if (warnings.length > 0) {
            status = 'YELLOW';
            statusText = '🟡 ЕСТЬ ПРЕДУПРЕЖДЕНИЯ';
        }

        return {
            score,
            status,
            statusText,
            criticalCount: criticals.length,
            warningCount: warnings.length,
            infoCount: issues.length - criticals.length - warnings.length
        };
    }

    /**
     * Фабрика 10-пассового авторемонта накладных 99%
     */
    static autoRepairRecords(schema, records, profileKey = "neofarm", aggressive = true, mathPolicy = "strict") {
        let fixedCount = 0;
        const logs = [];

        if (!records || records.length === 0) {
            return { repairedRecords: [], fixedCount: 0, logs: [] };
        }

        const firstRow = records[0];
        const masterDate = DateEngine.parseAnyDate(firstRow.DATEDOC) || new Date().toISOString().split('T')[0];
        const masterNdoc = String(firstRow.NDOC || '1').trim();
        const masterPodrcd = String(firstRow.PODRCD || '001').trim();

        const repairedRecords = records.map((rec, idx) => {
            const out = { ...rec };
            const rowNum = idx + 1;

            // ПАСС 1: Синхронизация реквизитов шапки
            if (!out.NDOC || out.NDOC !== masterNdoc) { out.NDOC = masterNdoc; fixedCount++; }
            if (!out.DATEDOC || out.DATEDOC !== masterDate) { out.DATEDOC = masterDate; fixedCount++; }
            if (!out.PODRCD || out.PODRCD !== masterPodrcd) { out.PODRCD = masterPodrcd; fixedCount++; }
            if (!out.BILLNUM) { out.BILLNUM = masterNdoc; fixedCount++; }
            if (!out.BILLDT) { out.BILLDT = masterDate; fixedCount++; }
            if (!out.NUMZ) { out.NUMZ = parseInt(masterNdoc, 10) || 1; fixedCount++; }
            if (!out.DATEZ) { out.DATEZ = masterDate; fixedCount++; }

            // ПАСС 2: Очистка артикулов и zfill нулей (6 -> 000006)
            if (out.CODEPST) {
                const origCode = String(out.CODEPST);
                let cleanCode = EncodingGuard.sanitizeCodepstProtek(origCode);
                if (/^\d+$/.test(cleanCode) && cleanCode.length < 6) {
                    cleanCode = cleanCode.padStart(6, '0');
                    logs.push(`Строка ${rowNum}: Артикул дополнен нулями ➔ '${cleanCode}'`);
                }
                if (cleanCode !== origCode) {
                    out.CODEPST = cleanCode;
                    fixedCount++;
                }
            }

            // ПАСС 3: Санация наименований по стандарту 36.6 / Протек
            if (out.NAME) {
                const origName = String(out.NAME);
                const cleanName = EncodingGuard.sanitizeText366(origName);
                if (cleanName !== origName) {
                    out.NAME = cleanName;
                    fixedCount++;
                }
            }
            if (out.FIRM) out.FIRM = EncodingGuard.sanitizeText366(out.FIRM);
            if (out.CNTR) out.CNTR = PharmaVocabulary.normalizeCountry(out.CNTR);

            // ПАСС 4: Реклассификация РУ и ГТД для товаров РФ
            const isRussia = PharmaVocabulary.normalizeCountry(out.CNTR) === "Россия";
            if (isRussia) {
                const gtdStr = String(out.NUMGTD || '').trim();
                if (this.RU_REG_PATTERNS.test(gtdStr)) {
                    if (!out.SERTIF || out.SERTIF === '-') out.SERTIF = gtdStr;
                    out.NUMGTD = "б/гтд";
                    fixedCount++;
                    logs.push(`Строка ${rowNum}: Номер РУ '${gtdStr}' перенесен в сертификаты, в NUMGTD установлено 'б/гтд'`);
                } else if (!gtdStr || ['none', 'null', '-', '0', 'б/н'].includes(gtdStr.toLowerCase())) {
                    out.NUMGTD = "б/гтд";
                    fixedCount++;
                }
            }

            // ПАСС 5: Серии и восстановление Триады Катрена
            if (!out.SER || this.DUMMY_SERIES.test(String(out.SER).trim())) {
                out.SER = "б/с";
                fixedCount++;
            }

            // ПАСС 6: Финансовая математика, дельта-НДС и умный 0% НДС
            const qnt = PharmaMath.cleanDecimal(out.QNT, 1.0);
            const p2 = PharmaMath.cleanDecimal(out.PRICE2, 0.0);
            const p2n = PharmaMath.cleanDecimal(out.PRICE2N, 0.0);
            const sumsnds = PharmaMath.cleanDecimal(out.SUMSNDS, 0.0);
            const ndsRaw = out.NDS;

            let nds = 10;
            if ((p2 > 0 && Math.abs(p2 - p2n) < 0.01) || (sumsnds === 0 && p2 > 0) || String(ndsRaw) === '0') {
                nds = 0;
            } else if (ndsRaw !== undefined && ndsRaw !== null && String(ndsRaw).trim() !== '') {
                nds = parseInt(ndsRaw, 10) || 10;
            }

            out.QNT = qnt;
            out.PRICE2 = p2;
            out.NDS = nds;

            if (mathPolicy === "strict" && p2 > 0) {
                const fin = PharmaMath.calculateLine(qnt, p2, nds);
                out.PRICE2N = fin.price2n;
                out.SUMSTR = fin.sumstr;
                out.SUMSNDS = fin.sumsnds;
            }

            // Восстановление цены изготовителя PRICE1 (для Триады Катрена)
            const p1 = PharmaMath.cleanDecimal(out.PRICE1, 0.0);
            if (p1 <= 0 && p2 > 0) {
                const ndsRate = 1.0 + (nds / 100.0);
                out.PRICE1 = PharmaMath.roundMoney(p2 / ndsRate);
                fixedCount++;
            }

            // ПАСС 7: Штрихкоды EAN-13 (GS1 Modulo-10) и генерация GTIN-14
            if (out.EAN13) {
                const repEan = GS1BarcodeValidator.repairEan13(out.EAN13);
                if (repEan.isModified) {
                    out.EAN13 = repEan.ean13;
                    fixedCount++;
                }
            }
            if (!out.GTIN && out.EAN13 && out.EAN13.length === 13) {
                out.GTIN = `0${out.EAN13}`;
                out.MARK = 1;
                fixedCount++;
            }

            // ПАСС 8: Очистка фиктивных GUID в SUBJID для НЕО-ФАРМ
            if (profileKey === "neofarm" || aggressive) {
                if (out.SUBJID && String(out.SUBJID).includes('00000000')) {
                    out.SUBJID = "";
                    fixedCount++;
                    logs.push(`Строка ${rowNum}: Поле SUBJID очищено от нулевого GUID`);
                }
            }

            // ПАСС 9: Strict Null для дат (аннулирование заглушек 1990 года)
            ['GDATE', 'DATEMADE', 'BILLDT', 'DATEZ', 'SERTDATE', 'PAYDATE', 'DATESALE'].forEach(dKey => {
                if (out[dKey]) {
                    const parsed = DateEngine.parseAnyDate(out[dKey]);
                    if (parsed !== out[dKey]) {
                        out[dKey] = parsed;
                        fixedCount++;
                    }
                }
            });

            // ПАСС 10: Безопасная байтовая обрезка текста под dBase III
            if (out.NAME && out.NAME.length > 250) {
                out.NAME = out.NAME.slice(0, 250).trim();
                fixedCount++;
            }

            return out;
        });

        logs.push(`Авторемонт: успешно обработано ${records.length} строк, устранено ${fixedCount} замечаний.`);
        return { repairedRecords, fixedCount, logs };
    }
}