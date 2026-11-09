/**
 * js/domain/jnvlp_registry.js - Справочник предельных надбавок ЖНВЛП по субъектам РФ
 * и генератор официального «Протокола согласования цен» (Постановление Правительства РФ № 865).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';

/**
 * Реестр предельных оптовых и розничных торговых надбавок к фактическим отпускным ценам
 * производителей на жизненно необходимые и важнейшие лекарственные препараты (ЖНВЛП).
 * Корзины:
 * - tier1: до 100 руб. включительно
 * - tier2: свыше 100 руб. до 500 руб. включительно
 * - tier3: свыше 500 руб.
 */
export const JNVLP_REGIONS = {
    "77": {
        code: "77",
        name: "г. Москва",
        wholesale: { tier1: 15.0, tier2: 12.0, tier3: 9.0 },
        retail:    { tier1: 28.0, tier2: 24.0, tier3: 16.0 },
        doc: "Приказ ДЭПиР г. Москвы № 45-ТР"
    },
    "50": {
        code: "50",
        name: "Московская область",
        wholesale: { tier1: 16.0, tier2: 13.0, tier3: 10.0 },
        retail:    { tier1: 29.0, tier2: 25.0, tier3: 17.0 },
        doc: "Распоряжение Мособлкомцен № 120-Р"
    },
    "78": {
        code: "78",
        name: "г. Санкт-Петербург",
        wholesale: { tier1: 14.5, tier2: 11.5, tier3: 8.5 },
        retail:    { tier1: 27.0, tier2: 22.0, tier3: 15.0 },
        doc: "Распоряжение Комитета по тарифам СПб № 74-р"
    },
    "47": {
        code: "47",
        name: "Ленинградская область",
        wholesale: { tier1: 15.5, tier2: 12.5, tier3: 9.5 },
        retail:    { tier1: 28.5, tier2: 23.5, tier3: 16.5 },
        doc: "Приказ ЛенРЭК № 98-п"
    },
    "23": {
        code: "23",
        name: "Краснодарский край",
        wholesale: { tier1: 16.0, tier2: 13.0, tier3: 10.0 },
        retail:    { tier1: 28.0, tier2: 23.0, tier3: 17.0 },
        doc: "Приказ РЭК Краснодарского края № 15/2024"
    },
    "66": {
        code: "66",
        name: "Свердловская область (Екатеринбург)",
        wholesale: { tier1: 17.0, tier2: 14.0, tier3: 10.5 },
        retail:    { tier1: 30.0, tier2: 25.0, tier3: 18.0 },
        doc: "Постановление РЭК Свердловской области № 62-ПК"
    },
    "54": {
        code: "54",
        name: "Новосибирская область",
        wholesale: { tier1: 18.0, tier2: 14.5, tier3: 11.0 },
        retail:    { tier1: 31.0, tier2: 26.0, tier3: 19.0 },
        doc: "Приказ ДТНР Новосибирской области № 88"
    },
    "16": {
        code: "16",
        name: "Республика Татарстан (Казань)",
        wholesale: { tier1: 15.0, tier2: 12.0, tier3: 9.0 },
        retail:    { tier1: 27.5, tier2: 22.5, tier3: 15.5 },
        doc: "Постановление Госкомитета РТ по тарифам № 32-15"
    },
    "52": {
        code: "52",
        name: "Нижегородская область",
        wholesale: { tier1: 16.5, tier2: 13.5, tier3: 9.5 },
        retail:    { tier1: 29.0, tier2: 24.0, tier3: 16.5 },
        doc: "Решение РСТ Нижегородской области № 21/5"
    },
    "61": {
        code: "61",
        name: "Ростовская область",
        wholesale: { tier1: 16.0, tier2: 13.0, tier3: 9.5 },
        retail:    { tier1: 28.0, tier2: 23.0, tier3: 16.0 },
        doc: "Постановление РСТ Ростовской области № 18/2"
    },
    "63": {
        code: "63",
        name: "Самарская область",
        wholesale: { tier1: 16.0, tier2: 13.0, tier3: 10.0 },
        retail:    { tier1: 28.5, tier2: 23.5, tier3: 16.5 },
        doc: "Приказ Минэкономразвития Самарской области № 42"
    },
    "74": {
        code: "74",
        name: "Челябинская область",
        wholesale: { tier1: 17.0, tier2: 13.5, tier3: 10.0 },
        retail:    { tier1: 29.5, tier2: 24.5, tier3: 17.5 },
        doc: "Постановление ЕТО Челябинской области № 19/4"
    },
    "25": {
        code: "25",
        name: "Приморский край (Владивосток)",
        wholesale: { tier1: 20.0, tier2: 16.0, tier3: 12.0 },
        retail:    { tier1: 34.0, tier2: 28.0, tier3: 20.0 },
        doc: "Постановление Агентства по тарифам Приморья № 30"
    }
};

export class JnvlpManager {
    /**
     * Получение предельной надбавки по региону, цене производителя и типу надбавки
     * @param {string} regionCode - Код региона (77, 50, 78 и т.д.)
     * @param {number} producerPrice - Фактическая цена производителя без НДС
     * @param {'wholesale'|'retail'} markupType 
     * @returns {{ maxPercent: number, tier: string, region: Object }}
     */
    static getMarkupRate(regionCode = "77", producerPrice = 0, markupType = "wholesale") {
        const region = JNVLP_REGIONS[regionCode] || JNVLP_REGIONS["77"];
        const rates = region[markupType] || region.wholesale;
        const price = Math.max(0, parseFloat(producerPrice) || 0);

        let tier = "tier1";
        let maxPercent = rates.tier1;

        if (price > 500) {
            tier = "tier3";
            maxPercent = rates.tier3;
        } else if (price > 100) {
            tier = "tier2";
            maxPercent = rates.tier2;
        }

        return { maxPercent, tier, region };
    }

    /**
     * Комплексный расчет цен для позиции ЖНВЛП
     */
    static calculatePriceChain(producerPrice, registryPrice, regionCode = "77", customWholesalePct = null, vatRate = 10) {
        const pPrice = Math.max(0, parseFloat(producerPrice) || 0);
        const rPrice = Math.max(0, parseFloat(registryPrice) || pPrice);
        const baseForMarkup = rPrice > 0 ? Math.min(pPrice, rPrice) : pPrice;

        const { maxPercent: maxWholesalePct, region } = this.getMarkupRate(regionCode, pPrice, "wholesale");
        const { maxPercent: maxRetailPct } = this.getMarkupRate(regionCode, pPrice, "retail");

        const actualWholesalePct = customWholesalePct !== null ? parseFloat(customWholesalePct) : maxWholesalePct;
        const wholesaleMarkupRub = PharmaMath.roundMoney(baseForMarkup * (actualWholesalePct / 100));
        const wholesalePriceNoVat = PharmaMath.roundMoney(pPrice + wholesaleMarkupRub);
        const maxWholesalePriceNoVat = PharmaMath.roundMoney(pPrice + (baseForMarkup * (maxWholesalePct / 100)));

        const vatRateNum = parseFloat(vatRate) || 10;
        const wholesalePriceWithVat = PharmaMath.roundMoney(wholesalePriceNoVat * (1 + vatRateNum / 100));
        const maxWholesalePriceWithVat = PharmaMath.roundMoney(maxWholesalePriceNoVat * (1 + vatRateNum / 100));

        // Розничный расчет
        const retailMarkupRub = PharmaMath.roundMoney(baseForMarkup * (maxRetailPct / 100));
        const retailPriceNoVat = PharmaMath.roundMoney(wholesalePriceNoVat + retailMarkupRub);
        const maxRetailPriceWithVat = PharmaMath.roundMoney(retailPriceNoVat * (1 + vatRateNum / 100));

        const isExceeded = actualWholesalePct > maxWholesalePct || (rPrice > 0 && pPrice > rPrice);

        return {
            producerPrice: pPrice,
            registryPrice: rPrice,
            baseForMarkup,
            region,
            maxWholesalePct,
            actualWholesalePct,
            wholesaleMarkupRub,
            wholesalePriceNoVat,
            wholesalePriceWithVat,
            maxWholesalePriceNoVat,
            maxWholesalePriceWithVat,
            maxRetailPct,
            retailMarkupRub,
            maxRetailPriceWithVat,
            isExceeded,
            excessReason: pPrice > rPrice ? "Превышена предельная зарегистрированная цена производителя" : 
                         (actualWholesalePct > maxWholesalePct ? "Превышена предельная оптовая надбавка региона" : "Норма")
        };
    }

    /**
     * Генерация официального Протокола согласования цен поставки ЖНВЛП (в Excel через SheetJS)
     */
    static generateProtocolExcel(records, metaHeader = {}, regionCode = "77") {
        if (!window.XLSX) throw new Error("SheetJS не подключен.");

        const region = JNVLP_REGIONS[regionCode] || JNVLP_REGIONS["77"];
        const docDate = metaHeader.DATEDOC || new Date().toISOString().split('T')[0];
        const docNum = metaHeader.NDOC || "1";
        const sender = metaHeader.SENDER_NAME || "Поставщик";
        const receiver = metaHeader.RCV_NAME || "Аптечная организация";

        const titleRows = [
            ["ПРОТОКОЛ СОГЛАСОВАНИЯ ЦЕН ПОСТАВКИ ЖИЗНЕННО НЕОБХОДИМЫХ И ВАЖНЕЙШИХ ЛЕКАРСТВЕННЫХ ПРЕПАРАТОВ"],
            [`К накладной № ${docNum} от ${DateEngine.formatForUI(docDate)}`],
            [`Субъект РФ: ${region.name} (${region.doc})`],
            [`Поставщик: ${sender}`],
            [`Получатель: ${receiver}`],
            []
        ];

        const headerRow = [
            "№",
            "Наименование лекарственного препарата, дозировка, форма выпуска",
            "Производитель, страна",
            "Серия",
            "Кол-во (упак)",
            "Предельная цена изготовителя (реестр), руб.",
            "Фактическая цена изготовителя без НДС, руб.",
            "Оптовая надбавка, %",
            "Оптовая надбавка, руб.",
            "Фактическая отпускная цена поставщика без НДС, руб.",
            "Ставка НДС, %",
            "Сумма НДС, руб.",
            "Отпускная цена поставщика с НДС, руб.",
            "Сумма с НДС, руб.",
            "Статус соответствия"
        ];

        const rows = [headerRow];
        let totalSum = 0;
        let totalNds = 0;

        records.forEach((r, idx) => {
            const p1 = PharmaMath.cleanDecimal(r.PRICE1, 0);
            const regPrc = PharmaMath.cleanDecimal(r.REGPRC, p1);
            const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0);
            const p2n = PharmaMath.cleanDecimal(r.PRICE2N, p2 / 1.10);
            const qnt = PharmaMath.cleanDecimal(r.QNT, 1);
            const nds = parseInt(r.NDS, 10) || 10;
            const sumstr = PharmaMath.cleanDecimal(r.SUMSTR, qnt * p2);
            const sumsnds = PharmaMath.cleanDecimal(r.SUMSNDS, sumstr - (sumstr / (1 + nds / 100)));

            totalSum += sumstr;
            totalNds += sumsnds;

            // Расчет фактической оптовой надбавки
            const basePrice = Math.min(p1, regPrc > 0 ? regPrc : p1);
            const actualMarkupRub = Math.max(0, p2n - p1);
            const actualMarkupPct = basePrice > 0 ? PharmaMath.roundMoney((actualMarkupRub / basePrice) * 100) : 0;

            const calc = this.calculatePriceChain(p1, regPrc, regionCode, actualMarkupPct, nds);
            const statusStr = calc.isExceeded ? `НАРУШЕНИЕ (${calc.excessReason})` : "СООТВЕТСТВУЕТ";

            rows.push([
                idx + 1,
                r.NAME || "-",
                `${r.FIRM || "-"}, ${r.CNTR || "-"}`,
                r.SER || "б/с",
                qnt,
                regPrc.toFixed(2),
                p1.toFixed(2),
                actualMarkupPct.toFixed(2) + "%",
                actualMarkupRub.toFixed(2),
                p2n.toFixed(2),
                nds + "%",
                sumsnds.toFixed(2),
                p2.toFixed(2),
                sumstr.toFixed(2),
                statusStr
            ]);
        });

        rows.push([]);
        rows.push([
            "ИТОГО ПО ПРОТОКОЛУ:", "", "", "", "", "", "", "", "", "", "",
            totalNds.toFixed(2), "", totalSum.toFixed(2), ""
        ]);

        const allData = [...titleRows, ...rows];
        const ws = window.XLSX.utils.aoa_to_sheet(allData);

        // Настройка ширины колонок
        ws['!cols'] = [
            { wch: 5 },  { wch: 35 }, { wch: 25 }, { wch: 12 }, { wch: 10 },
            { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 18 },
            { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 16 }, { wch: 20 }
        ];

        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, "Протокол ЖНВЛП");
        return wb;
    }

    /**
     * Скачивание протокола ЖНВЛП в формате Excel
     */
    static downloadProtocolExcel(records, metaHeader = {}, regionCode = "77") {
        const wb = this.generateProtocolExcel(records, metaHeader, regionCode);
        const fileName = `Протокол_ЖНВЛП_№${metaHeader.NDOC || '1'}_${regionCode}.xlsx`;
        window.XLSX.writeFile(wb, fileName);
    }

    static REGIONAL_TARIFFS = JNVLP_REGIONS;

    /**
     * Преобразование кода региона ('moscow' -> '77', etc.)
     */
    static normalizeRegionCode(regionKey) {
        if (!regionKey) return "77";
        if (JNVLP_REGIONS[regionKey]) return regionKey;
        const map = {
            "moscow": "77",
            "mo": "50",
            "spb": "78",
            "lenobl": "47",
            "krasnodar": "23",
            "sverdlovsk": "66",
            "novosibirsk": "54",
            "tatarstan": "16",
            "nizhny": "52",
            "rostov": "61",
            "samara": "63",
            "chelyabinsk": "74",
            "primorsky": "25"
        };
        return map[String(regionKey).toLowerCase()] || "77";
    }

    /**
     * Комплексный расчет предельных цен ЖНВЛП
     */
    static calculateLimitPrices({ regionKey = "77", regPrice = 0, manufacturerFactPrice = 0, wholesaleFactMarkup = 0, retailFactMarkup = 0, ndsPct = 10 }) {
        const code = this.normalizeRegionCode(regionKey);
        const res = this.calculatePriceChain(manufacturerFactPrice, regPrice, code, wholesaleFactMarkup, ndsPct);
        const regionObj = JNVLP_REGIONS[code] || JNVLP_REGIONS["77"];

        return {
            region: regionObj.name,
            regionCode: code,
            tier: res.region?.tier || "tier2",
            maxWholesaleMarkupPct: res.maxWholesalePct,
            maxRetailMarkupPct: res.maxRetailPct,
            maxWholesalePriceWithoutNds: res.maxWholesalePriceNoVat,
            maxWholesalePriceWithNds: res.maxWholesalePriceWithVat,
            maxRetailPriceWithNds: res.maxRetailPriceWithVat,
            isWholesaleExcess: res.actualWholesalePct > res.maxWholesalePct,
            isRetailExcess: false,
            isExceeded: res.isExceeded,
            excessReason: res.excessReason
        };
    }
}
