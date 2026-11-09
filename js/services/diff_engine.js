/**
 * js/services/diff_engine.js - Двухоконный движок сравнения накладных (Visual Diff Studio).
 * 
 * Выполняет каскадное выравнивание строк двух документов (А vs Б),
 * детальный аудит расхождений реквизитов (Цены, Количества, Серии, Сроки, НДС)
 * и расчет сальдо взаиморасчетов (Δ Сумма).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { EncodingGuard } from '../engine/text_engine.js';

export class DiffRowResult {
    constructor(status, key, recA = null, recB = null, changes = []) {
        this.status = status; // 'UNCHANGED' | 'MODIFIED' | 'ADDED' | 'REMOVED'
        this.key = key;
        this.recA = recA;
        this.recB = recB;
        this.changes = changes; // Array of { field, fieldTitle, valA, valB }
    }
}

export class InvoiceDiffEngine {
    static FIELDS_TO_COMPARE = [
        { key: 'QNT', title: 'Кол-во', type: 'num' },
        { key: 'PRICE2', title: 'Цена с НДС', type: 'num' },
        { key: 'PRICE2N', title: 'Цена без НДС', type: 'num' },
        { key: 'SUMSTR', title: 'Сумма с НДС', type: 'num' },
        { key: 'SER', title: 'Серия', type: 'str' },
        { key: 'GDATE', title: 'Срок годности', type: 'date' },
        { key: 'NDS', title: 'НДС %', type: 'int' },
        { key: 'NUMGTD', title: 'ГТД', type: 'str' },
        { key: 'EAN13', title: 'Штрихкод', type: 'str' }
    ];

    /**
     * Сравнение двух массивов строк накладных
     * @param {Array<Object>} recordsA - Исходный документ
     * @param {Array<Object>} recordsB - Корректировка / Новая редакция
     * @returns {Object} - Сводка расхождений
     */
    static compareInvoices(recordsA = [], recordsB = []) {
        const rowsA = Array.isArray(recordsA) ? recordsA : [];
        const rowsB = Array.isArray(recordsB) ? recordsB : [];

        // Индексация документа А по CODEPST -> EAN13 -> NAME
        const mapA = new Map();
        rowsA.forEach((r, idx) => {
            const key = this._getRowKey(r, idx);
            mapA.set(key, { record: r, idx });
        });

        const visitedKeysA = new Set();
        const diffResults = [];

        let countUnchanged = 0;
        let countModified = 0;
        let countAdded = 0;
        let countRemoved = 0;

        let totalSumA = 0;
        let totalSumB = 0;

        rowsA.forEach(r => { totalSumA += PharmaMath.cleanDecimal(r.SUMSTR, 0); });
        rowsB.forEach(r => { totalSumB += PharmaMath.cleanDecimal(r.SUMSTR, 0); });

        // 1. Проход по строкам документа Б
        rowsB.forEach((rB, idxB) => {
            const key = this._getRowKey(rB, idxB);
            const foundA = mapA.get(key);

            if (foundA) {
                visitedKeysA.add(key);
                const rA = foundA.record;
                const changes = this._compareFields(rA, rB);

                if (changes.length === 0) {
                    countUnchanged++;
                    diffResults.push(new DiffRowResult('UNCHANGED', key, rA, rB, []));
                } else {
                    countModified++;
                    diffResults.push(new DiffRowResult('MODIFIED', key, rA, rB, changes));
                }
            } else {
                countAdded++;
                diffResults.push(new DiffRowResult('ADDED', key, null, rB, [
                    { field: 'ALL', fieldTitle: 'Строка', valA: 'ОТСУТСТВОВАЛА', valB: 'ДОБАВЛЕНА' }
                ]));
            }
        });

        // 2. Поиск строк, удаленных из документа А
        mapA.forEach((valA, key) => {
            if (!visitedKeysA.has(key)) {
                countRemoved++;
                diffResults.push(new DiffRowResult('REMOVED', key, valA.record, null, [
                    { field: 'ALL', fieldTitle: 'Строка', valA: 'ПРИСУТСТВОВАЛА', valB: 'УДАЛЕНА' }
                ]));
            }
        });

        const deltaSum = PharmaMath.roundMoney(totalSumB - totalSumA);

        const diffRows = diffResults.map(dr => {
            const rec = dr.recB || dr.recA || {};
            return {
                ...rec,
                _diffStatus: dr.status === 'REMOVED' ? 'DELETED' : dr.status,
                _diffChanges: dr.changes
            };
        });

        const summary = {
            equalCount: countUnchanged,
            modifiedCount: countModified,
            addedCount: countAdded,
            deletedCount: countRemoved,
            totalSumDelta: deltaSum
        };

        return {
            totalA: rowsA.length,
            totalB: rowsB.length,
            totalSumA: PharmaMath.roundMoney(totalSumA),
            totalSumB: PharmaMath.roundMoney(totalSumB),
            deltaSum,
            countUnchanged,
            countModified,
            countAdded,
            countRemoved,
            totalDiffs: countModified + countAdded + countRemoved,
            results: diffResults,
            summary,
            diffRows
        };
    }

    static _getRowKey(record, fallbackIdx) {
        const code = EncodingGuard.sanitizeCodepstProtek(record.CODEPST);
        if (code) return `code_${code}`;
        const ean = String(record.EAN13 || '').trim();
        if (ean && ean.length >= 8) return `ean_${ean}`;
        const name = String(record.NAME || '').trim().toLowerCase().slice(0, 30);
        if (name) return `name_${name}`;
        return `idx_${fallbackIdx}`;
    }

    static _compareFields(rA, rB) {
        const changes = [];

        this.FIELDS_TO_COMPARE.forEach(({ key, title, type }) => {
            const vA = rA[key];
            const vB = rB[key];

            if (type === 'num') {
                const nA = PharmaMath.cleanDecimal(vA, 0);
                const nB = PharmaMath.cleanDecimal(vB, 0);
                if (Math.abs(nA - nB) > 0.01) {
                    changes.push({ field: key, fieldTitle: title, valA: nA.toFixed(2), valB: nB.toFixed(2) });
                }
            } else if (type === 'date') {
                const dA = DateEngine.parseAnyDate(vA);
                const dB = DateEngine.parseAnyDate(vB);
                if (dA !== dB) {
                    changes.push({ field: key, fieldTitle: title, valA: DateEngine.formatForUI(dA) || 'НЕТ', valB: DateEngine.formatForUI(dB) || 'НЕТ' });
                }
            } else if (type === 'int') {
                const iA = parseInt(vA, 10) || 0;
                const iB = parseInt(vB, 10) || 0;
                if (iA !== iB) {
                    changes.push({ field: key, fieldTitle: title, valA: String(iA), valB: String(iB) });
                }
            } else {
                const sA = String(vA || '').trim();
                const sB = String(vB || '').trim();
                if (sA !== sB) {
                    changes.push({ field: key, fieldTitle: title, valA: sA || 'ПУСТО', valB: sB || 'ПУСТО' });
                }
            }
        });

        return changes;
    }

    /**
     * Экспорт отчета сравнения в Excel
     */
    static exportDiffExcel(diffReport, fileNameA = "Документ_А", fileNameB = "Документ_Б") {
        if (!window.XLSX) return;

        const headerRows = [
            ["ПРОТОКОЛ СРАВНЕНИЯ НАКЛАДНЫХ PHARMAGATE VISUAL DIFF"],
            [`Документ А (Исходный): ${fileNameA} (Сумма: ${diffReport.totalSumA.toFixed(2)} ₽, Строк: ${diffReport.totalA})`],
            [`Документ Б (Новый): ${fileNameB} (Сумма: ${diffReport.totalSumB.toFixed(2)} ₽, Строк: ${diffReport.totalB})`],
            [`Финансовая разница (Δ): ${diffReport.deltaSum > 0 ? '+' : ''}${diffReport.deltaSum.toFixed(2)} ₽`],
            [`Изменено: ${diffReport.countModified} | Добавлено: ${diffReport.countAdded} | Удалено: ${diffReport.countRemoved}`],
            []
        ];

        const tableHeader = ["№", "Статус", "Артикул", "Наименование", "Измененные реквизиты (Было ➔ Станет)"];
        const rows = [tableHeader];

        diffReport.results.filter(r => r.status !== 'UNCHANGED').forEach((r, idx) => {
            const rec = r.recB || r.recA;
            const statusRu = r.status === 'MODIFIED' ? 'ИЗМЕНЕНО' : (r.status === 'ADDED' ? 'ДОБАВЛЕНО' : 'УДАЛЕНО');
            const detailsStr = r.changes.map(c => `${c.fieldTitle}: [${c.valA}] ➔ [${c.valB}]`).join('; ');

            rows.push([
                idx + 1,
                statusRu,
                rec?.CODEPST || "-",
                rec?.NAME || "-",
                detailsStr
            ]);
        });

        const ws = window.XLSX.utils.aoa_to_sheet([...headerRows, ...rows]);
        ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 14 }, { wch: 35 }, { wch: 60 }];

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Сравнение накладных");
        window.XLSX.writeFile(wb, "Акт_сравнения_накладных.xlsx");
    }
}
