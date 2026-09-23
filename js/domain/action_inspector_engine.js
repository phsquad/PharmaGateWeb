/**
 * js/domain/action_inspector_engine.js - Движок аудита и выборочного применения исправлений.
 * 
 * Формирует прозрачный список из 10 атомарных задач с генерацией образцов Diff (Было ➔ Станет)
 * и градацией по уровням риска (LOW / MEDIUM / HIGH).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath, GS1BarcodeValidator } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { EncodingGuard } from '../engine/text_engine.js';
import { PharmaVocabulary } from './pharma_vocab.js';

export class RowDiffSample {
    constructor(rowIndex, fieldName, oldValue, newValue, description) {
        this.rowIndex = rowIndex;
        this.fieldName = fieldName;
        this.oldValue = oldValue;
        this.newValue = newValue;
        this.description = description;
    }
}

export class ProposedAction {
    constructor(actionId, title, description, category, affectedRowsCount, affectedIndices, diffSamples, isRecommended = true, isChecked = true, riskLevel = "LOW") {
        this.actionId = actionId;
        this.title = title;
        this.description = description;
        this.category = category;
        this.affectedRowsCount = affectedRowsCount;
        this.affectedIndices = affectedIndices;
        this.diffSamples = diffSamples;
        this.isRecommended = isRecommended;
        this.isChecked = isChecked;
        this.riskLevel = riskLevel;
    }
}

export class ActionInspectorEngine {
    /**
     * Формирует план действий на основе аудита массива строк
     * @param {Object} schema 
     * @param {Array<Object>} records 
     * @param {string} profileKey 
     * @returns {Array<ProposedAction>}
     */
    static generateActionPlan(schema, records, profileKey = "neofarm") {
        const actions = [];
        if (!records || records.length === 0) return actions;

        const firstRow = records[0];
        const today = new Date().toISOString().split('T')[0];
        const masterDate = DateEngine.parseAnyDate(firstRow.DATEDOC) || today;
        const masterNdoc = String(firstRow.NDOC || '1').trim();

        // 1. Синхронизация даты накладной (DATEDOC)
        const dateDiffs = [];
        const dateIndices = [];
        records.forEach((r, idx) => {
            const curD = DateEngine.parseAnyDate(r.DATEDOC);
            if (curD !== masterDate || !r.DATEDOC) {
                const rowNum = idx + 1;
                dateIndices.push(rowNum);
                dateDiffs.push(new RowDiffSample(
                    rowNum, "DATEDOC",
                    DateEngine.formatForUI(r.DATEDOC) || "ПУСТО",
                    DateEngine.formatForUI(masterDate),
                    "Синхронизация даты накладной по первой строке"
                ));
            }
        });

        if (dateIndices.length > 0) {
            actions.push(new ProposedAction(
                "ACT_SYNC_DATEDOC",
                `Синхронизировать дату документа (${DateEngine.formatForUI(masterDate)})`,
                "Дата накладной в некоторых строках отличается от первой строки. Шлюзы сетей требуют единую дату.",
                "Реквизиты и Даты",
                dateIndices.length,
                dateIndices,
                dateDiffs.slice(0, 5),
                true, true, "LOW"
            ));
        }

        // 2. ГТД и РУ для товаров РФ
        const gtdDiffs = [];
        const gtdIndices = [];
        records.forEach((r, idx) => {
            const isRussia = PharmaVocabulary.normalizeCountry(r.CNTR) === "Россия";
            const gtd = String(r.NUMGTD || '').trim();
            if (isRussia && (/рзн|фср|фс|ру/i.test(gtd) || !gtd || ['none', 'null', '-', '0'].includes(gtd.toLowerCase()))) {
                const rowNum = idx + 1;
                gtdIndices.push(rowNum);
                gtdDiffs.push(new RowDiffSample(
                    rowNum, "NUMGTD",
                    gtd || "ПУСТО",
                    "б/гтд",
                    "Подстановка обязательного значения 'б/гтд' для товаров РФ"
                ));
            }
        });

        if (gtdIndices.length > 0) {
            actions.push(new ProposedAction(
                "ACT_RECLASSIFY_GTD_RU",
                `Подставить 'б/гтд' для товаров РФ (${gtdIndices.length} строк)`,
                "Для товаров российского производства в поле NUMGTD должно стоять строго 'б/гтд', а номер РУ перенесен в сертификаты.",
                "Таможня и РУ",
                gtdIndices.length,
                gtdIndices,
                gtdDiffs.slice(0, 5),
                true, true, "LOW"
            ));
        }

        // 3. Восстановление ведущих нулей артикулов
        const padDiffs = [];
        const padIndices = [];
        records.forEach((r, idx) => {
            const rawCode = String(r.CODEPST || '').trim();
            if (/^\d+$/.test(rawCode) && rawCode.length < 6) {
                const rowNum = idx + 1;
                const padded = rawCode.padStart(6, '0');
                padIndices.push(rowNum);
                padDiffs.push(new RowDiffSample(
                    rowNum, "CODEPST",
                    rawCode,
                    padded,
                    `Восстановление нулей: '${rawCode}' ➔ '${padded}'`
                ));
            }
        });

        if (padIndices.length > 0) {
            actions.push(new ProposedAction(
                "ACT_PAD_CODEPST_ZEROS",
                `Восстановить ведущие нули артикулов (${padIndices.length} строк)`,
                "Excel отсек ведущие нули у числовых кодов (например, '6' вместо '000006').",
                "Коды и Штрихкоды",
                padIndices.length,
                padIndices,
                padDiffs.slice(0, 5),
                true, true, "LOW"
            ));
        }

        // 4. Финансовая балансировка строк (SUMSTR = QNT * PRICE2)
        const mathDiffs = [];
        const mathIndices = [];
        records.forEach((r, idx) => {
            const qnt = PharmaMath.cleanDecimal(r.QNT, 0.0);
            const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
            const sumstr = PharmaMath.cleanDecimal(r.SUMSTR, 0.0);

            if (qnt > 0 && p2 > 0) {
                const calcSum = PharmaMath.roundMoney(qnt * p2);
                if (Math.abs(calcSum - sumstr) > 0.0) {
                    const rowNum = idx + 1;
                    mathIndices.push(rowNum);
                    mathDiffs.push(new RowDiffSample(
                        rowNum, "SUMSTR",
                        sumstr.toFixed(2),
                        calcSum.toFixed(2),
                        `Балансировка QNT*PRICE2 (разница ${Math.abs(calcSum - sumstr).toFixed(2)} руб.)`
                    ));
                }
            }
        });

        if (mathIndices.length > 0) {
            actions.push(new ProposedAction(
                "ACT_RECALC_MATH_SUMSTR",
                `Отбалансировать суммы строк QNT * PRICE2 (${mathIndices.length} строк)`,
                "Сумма строки отличается от произведения цены на количество из-за округления скидок в 1С.",
                "Финансы и НДС",
                mathIndices.length,
                mathIndices,
                mathDiffs.slice(0, 5),
                true, true, "MEDIUM"
            ));
        }

        // 5. Санация типографики по стандарту 36.6 / Протек
        const textDiffs = [];
        const textIndices = [];
        records.forEach((r, idx) => {
            const rawName = String(r.NAME || '');
            const cleanName = EncodingGuard.sanitizeText366(rawName);
            if (cleanName !== rawName && rawName) {
                const rowNum = idx + 1;
                textIndices.push(rowNum);
                textDiffs.push(new RowDiffSample(
                    rowNum, "NAME",
                    rawName.slice(0, 35) + "...",
                    cleanName.slice(0, 35) + "...",
                    "Замена кавычек «», длинных тире, символа № и спецсимволов"
                ));
            }
        });

        if (textIndices.length > 0) {
            actions.push(new ProposedAction(
                "ACT_SANITIZE_TYPOGRAPHY",
                `Санировать типографику под стандарт 36.6 (${textIndices.length} строк)`,
                "Заменяет символы, отсутствующие в кодировке DOS CP866 («», —, №, °, ±).",
                "Санация Текста",
                textIndices.length,
                textIndices,
                textDiffs.slice(0, 5),
                true, true, "LOW"
            ));
        }

        // 6. Очистка фиктивного SUBJID для НЕО-ФАРМ
        if (profileKey === "neofarm") {
            const subjDiffs = [];
            const subjIndices = [];
            records.forEach((r, idx) => {
                const subjid = String(r.SUBJID || '').trim();
                if (subjid.includes('00000000')) {
                    const rowNum = idx + 1;
                    subjIndices.push(rowNum);
                    subjDiffs.push(new RowDiffSample(
                        rowNum, "SUBJID",
                        subjid,
                        "",
                        "Очистка фиктивного GUID до пустой строки"
                    ));
                }
            });

            if (subjIndices.length > 0) {
                actions.push(new ProposedAction(
                    "ACT_CLEAR_NEOFARM_SUBJID",
                    `Очистить нулевой GUID в SUBJID для НЕО-ФАРМ (${subjIndices.length} строк)`,
                    "Шлюз НЕО-ФАРМ падает с ошибкой схемы XSD при получении фиктивного GUID.",
                    "Маркировка МДЛП",
                    subjIndices.length,
                    subjIndices,
                    subjDiffs.slice(0, 5),
                    true, true, "LOW"
                ));
            }
        }

        return actions;
    }

    /**
     * Применяет ТОЛЬКО те действия, которые оператор выбрал чекбоксами
     * @param {Object} schema 
     * @param {Array<Object>} records 
     * @param {Set<string>} selectedActionIds 
     * @param {string} profileKey 
     * @returns {{ repairedRecords: Array<Object>, appliedCount: number, logs: Array<string> }}
     */
    static applySelectedActions(schema, records, selectedActionIds, profileKey = "neofarm") {
        const logs = [];
        let appliedCount = 0;

        if (!records || records.length === 0 || !selectedActionIds || selectedActionIds.size === 0) {
            return { repairedRecords: records, appliedCount: 0, logs: ["Нет выбранных действий к применению."] };
        }

        const firstRow = records[0];
        const masterDate = DateEngine.parseAnyDate(firstRow.DATEDOC) || new Date().toISOString().split('T')[0];
        const masterNdoc = String(firstRow.NDOC || '1').trim();

        const repairedRecords = records.map((rec, idx) => {
            const out = { ...rec };
            const rowNum = idx + 1;

            if (selectedActionIds.has("ACT_SYNC_DATEDOC")) {
                if (out.DATEDOC !== masterDate) {
                    out.DATEDOC = masterDate;
                    appliedCount++;
                }
            }

            if (selectedActionIds.has("ACT_RECLASSIFY_GTD_RU")) {
                const isRussia = PharmaVocabulary.normalizeCountry(out.CNTR) === "Россия";
                const gtd = String(out.NUMGTD || '').trim();
                if (isRussia && (/рзн|фср|фс|ру/i.test(gtd) || !gtd || ['none', 'null', '-', '0'].includes(gtd.toLowerCase()))) {
                    if (!out.SERTIF || out.SERTIF === '-') out.SERTIF = gtd;
                    out.NUMGTD = "б/гтд";
                    appliedCount++;
                }
            }

            if (selectedActionIds.has("ACT_PAD_CODEPST_ZEROS")) {
                const codeRaw = String(out.CODEPST || '').trim();
                if (/^\d+$/.test(codeRaw) && codeRaw.length < 6) {
                    out.CODEPST = codeRaw.padStart(6, '0');
                    appliedCount++;
                }
            }

            if (selectedActionIds.has("ACT_SANITIZE_TYPOGRAPHY")) {
                if (out.NAME) out.NAME = EncodingGuard.sanitizeText366(out.NAME);
                if (out.FIRM) out.FIRM = EncodingGuard.sanitizeText366(out.FIRM);
                appliedCount++;
            }

            if (selectedActionIds.has("ACT_CLEAR_NEOFARM_SUBJID")) {
                if (out.SUBJID && String(out.SUBJID).includes('00000000')) {
                    out.SUBJID = "";
                    appliedCount++;
                }
            }

            if (selectedActionIds.has("ACT_RECALC_MATH_SUMSTR")) {
                const qnt = PharmaMath.cleanDecimal(out.QNT, 1.0);
                const p2 = PharmaMath.cleanDecimal(out.PRICE2, 0.0);
                if (qnt > 0 && p2 > 0) {
                    out.SUMSTR = PharmaMath.roundMoney(qnt * p2);
                    appliedCount++;
                }
            }

            return out;
        });

        logs.push(`Инспектор правок: успешно применено ${appliedCount} изменений.`);
        return { repairedRecords, appliedCount, logs };
    }
}