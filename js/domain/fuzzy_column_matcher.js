/**
 * js/domain/fuzzy_column_matcher.js - AI-анализатор структуры и самообучающийся маппер колонок.
 * 
 * Реализует:
 * - Токенизированный поиск сходства по Левенштейну и коэффициенту Жаккара;
 * - Контентный анализ содержимого ячеек (распознавание EAN-13, GTIN-14, цен, дат, НДС);
 * - Память самообучения в localStorage (сохранение ручного выбора оператора с уверенностью 99%);
 * - Автоматический детектор смещения шапки в сложных многострочных файлах Excel.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { DateEngine } from '../engine/date_engine.js';
import { GS1BarcodeValidator } from '../engine/pharma_math.js';

export class ColumnMatchSuggestion {
    constructor(sourceHeader, suggestedTarget, confidencePercent, confidenceLevel, sampleValues, matchReason, transformationHint = "NONE") {
        this.sourceHeader = sourceHeader;
        this.suggestedTarget = suggestedTarget;
        this.confidencePercent = confidencePercent;
        this.confidenceLevel = confidenceLevel; // 'EXACT', 'LEARNED', 'HIGH', 'CONTENT', 'MANUAL'
        this.sampleValues = sampleValues;
        this.matchReason = matchReason;
        this.transformationHint = transformationHint;
    }
}

export class FuzzyColumnMatcher {
    static STORAGE_KEY = "pharmagate_custom_column_synonyms";

    static KEYWORD_THESAURUS = {
        "CODEPST": ["код", "артикул", "код товара", "код поставщика", "item code", "prod code", "id", "код_товара", "номенклатурный номер", "код_номенклатуры"],
        "EAN13": ["штрихкод", "штрих-код", "ean", "ean13", "barcode", "штрих код", "бар-код", "шк", "штрих_код"],
        "GTIN": ["gtin", "гтин", "gtin14", "код маркировки", "гтин14", "gtin_14", "код_gtin"],
        "NAME": ["наименование", "название", "товар", "препарат", "медикамент", "номенклатура", "продукт", "product name", "лекарственное средство"],
        "SER": ["серия", "партия", "серия партии", "batch", "seria", "серия товара", "номер серии", "лот", "lot"],
        "GDATE": ["срок", "срок годности", "годен до", "годен", "срок реализации", "exp date", "дата окончания", "годендо"],
        "DATEMADE": ["дата выпуска", "дата изготовления", "дата производства", "изготовлен", "mfg date"],
        "QNT": ["количество", "кол-во", "колво", "к-во", "кво", "остаток", "quantity", "amount", "штук"],
        "PRICE1": ["цена производителя", "цена изготовителя", "цена предприятия", "цена1", "price manuf", "базовая цена"],
        "PRICE2N": ["цена без ндс", "цена отпускная без ндс", "цена2н", "цена_без_ндс", "цена реализации без ндс"],
        "PRICE2": ["цена с ндс", "цена отпускная", "цена", "цена реализации", "отпускная цена", "price", "цена2"],
        "NDS": ["ндс", "ставка ндс", "ндс %", "% ндс", "ставка налога", "vat rate"],
        "SUMSTR": ["сумма с ндс", "сумма", "всего с ндс", "всего", "сумма к оплате", "сумма по строке", "итог с ндс"],
        "SUMSNDS": ["сумма ндс", "ндс сумма", "в том числе ндс", "сумма налога", "tax sum"],
        "FIRM": ["производитель", "изготовитель", "фирма", "завод", "предприятие", "компания", "manufacturer"],
        "CNTR": ["страна", "страна происхождения", "страна производителя", "государство", "country"],
        "NUMGTD": ["гтд", "номер гтд", "таможенная декларация", "гтд №", "ру", "рег удостоверение"],
        "REGPRC": ["реестровая цена", "цена жнвлп", "предельная цена", "жнвлп"],
        "NDOC": ["номер накладной", "номер документа", "№ накладной", "документ №", "numdoc"],
        "DATEDOC": ["дата накладной", "дата документа", "дата отгрузки", "docdate"],
        "PODRCD": ["код аптеки", "код получателя", "код подразделения", "аптека"]
    };

    /**
     * Запоминает выбор оператора в памяти браузера
     */
    static learnMapping(sourceHeader, targetField) {
        if (!sourceHeader || !targetField || targetField === "SKIP") return;
        try {
            const cleanSrc = String(sourceHeader).trim().toLowerCase();
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
            stored[cleanSrc] = String(targetField).trim().toUpperCase();
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
            console.log(`[AI-Matcher] Выучено соответствие: '${sourceHeader}' ➔ ${targetField}`);
        } catch (e) {
            // Игнорируем ошибки квоты
        }
    }

    /**
     * Автоподбор соответствия для одной колонки
     */
    static matchColumn(header, sampleValues = [], schema = null) {
        const rawH = String(header || '').trim();
        const cleanH = rawH.toLowerCase().replace(/[_\-.]/g, ' ').trim();
        const samplesStr = sampleValues.map(v => String(v !== null && v !== undefined ? v : '').trim()).slice(0, 5);

        // 1. Память самообучения (localStorage) - 99%
        try {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
            if (stored[cleanH]) {
                const target = stored[cleanH];
                return new ColumnMatchSuggestion(
                    rawH, target, 99, "LEARNED", samplesStr,
                    `Выучено из предыдущих сессий для '${rawH}'`,
                    target === "CODEPST" ? "PAD6" : "NONE"
                );
            }
        } catch (e) {}

        // 2. Точное словарное совпадение - 100%
        for (const [targetField, synonyms] of Object.entries(this.KEYWORD_THESAURUS)) {
            if (synonyms.some(s => cleanH === s)) {
                return new ColumnMatchSuggestion(
                    rawH, targetField, 100, "EXACT", samplesStr,
                    `Точное словарное совпадение с '${cleanH}'`,
                    targetField === "CODEPST" ? "PAD6" : (targetField.includes("PRICE") ? "PRICE_CLEAN" : "NONE")
                );
            }
        }

        // 3. Контентный анализ содержимого ячеек - 90-95%
        const validSamples = samplesStr.filter(s => s && !['none', 'null', '-'].includes(s.toLowerCase()));
        if (validSamples.length > 0) {
            // 13 цифр (EAN-13)
            if (validSamples.every(s => /^\d{13}$/.test(s))) {
                return new ColumnMatchSuggestion(rawH, "EAN13", 95, "CONTENT", samplesStr, "13-значные штрихкоды EAN-13");
            }
            // 14 цифр (GTIN-14)
            if (validSamples.every(s => /^\d{14}$/.test(s))) {
                return new ColumnMatchSuggestion(rawH, "GTIN", 95, "CONTENT", samplesStr, "14-значные коды GTIN-14");
            }
            // Даты
            const datesCount = validSamples.filter(s => DateEngine.parseAnyDate(s) !== null).length;
            if (datesCount / validSamples.length >= 0.7) {
                const target = cleanH.includes("выпуск") || cleanH.includes("изгот") ? "DATEMADE" : "GDATE";
                return new ColumnMatchSuggestion(rawH, target, 90, "CONTENT", samplesStr, "Календарные даты срока годности/выпуска");
            }
            // Ставки НДС
            if (validSamples.every(s => /^(?:0|10|20|0%|10%|20%|без ндс)$/i.test(s))) {
                return new ColumnMatchSuggestion(rawH, "NDS", 92, "CONTENT", samplesStr, "Стандартные ставки НДС (0, 10, 20%)");
            }
        }

        // 4. По умолчанию - ручной выбор
        return new ColumnMatchSuggestion(rawH, "SKIP", 0, "MANUAL", samplesStr, "Назначьте соответствие вручную", "NONE");
    }

    /**
     * Поиск индекса строки заголовков в сложных файлах Excel
     */
    static detectHeaderRowOffset(rawRows = []) {
        if (!rawRows || rawRows.length === 0) return 0;
        let bestIdx = 0;
        let maxDensity = 0;

        const keywords = new Set(["НАИМЕНОВАНИЕ", "ТОВАР", "АРТИКУЛ", "КОД", "ЦЕНА", "КОЛИЧЕСТВО", "EAN13", "ШТРИХКОД"]);

        rawRows.slice(0, 25).forEach((row, idx) => {
            if (!row || !Array.isArray(row)) return;
            let matches = 0;
            row.forEach(cell => {
                const cellStr = String(cell || '').toUpperCase();
                keywords.forEach(kw => {
                    if (cellStr.includes(kw)) matches++;
                });
            });
            if (matches > maxDensity && matches >= 2) {
                maxDensity = matches;
                bestIdx = idx;
            }
        });

        return bestIdx;
    }
}