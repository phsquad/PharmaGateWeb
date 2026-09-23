/**
 * js/domain/column_presets.js - Менеджер шаблонов сопоставления колонок поставщиков.
 * 
 * Включает готовые спецификации ключевых фарм-дистрибьюторов:
 * - ЗАО ЦВ Протек
 * - АО НПК Катрен / Аптека.ру
 * - ООО ФК Пульс
 * - АО Фармкомплект
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class ColumnPresetManager {
    static STORAGE_KEY = "pharmagate_custom_mapping_presets";

    static DEFAULT_PRESETS = {
        "protek_excel": {
            name: "Протек — Накладная Excel",
            supplier: "ЗАО ЦВ Протек",
            mapping: {
                "КОД ТОВАРА": "CODEPST",
                "ШТРИХ-КОД": "EAN13",
                "НАИМЕНОВАНИЕ ТОВАРА": "NAME",
                "СЕРИЯ": "SER",
                "СРОК ГОДНОСТИ": "GDATE",
                "КОЛ-ВО": "QNT",
                "ЦЕНА ПРОИЗВОДИТЕЛЯ": "PRICE1",
                "ЦЕНА БЕЗ НДС": "PRICE2N",
                "ЦЕНА С НДС": "PRICE2",
                "СТАВКА НДС": "NDS",
                "СУММА С НДС": "SUMSTR",
                "СУММА НДС": "SUMSNDS",
                "СТРАНА": "CNTR",
                "ПРОИЗВОДИТЕЛЬ": "FIRM",
                "ГТД": "NUMGTD"
            }
        },
        "katren_excel": {
            name: "Катрен / Аптека.ру — Накладная",
            supplier: "АО НПК Катрен",
            mapping: {
                "АРТИКУЛ": "CODEPST",
                "ШТРИХКОД": "EAN13",
                "ТОВАР": "NAME",
                "СЕРИЯ ПАРТИИ": "SER",
                "ГОДЕН ДО": "GDATE",
                "КОЛИЧЕСТВО": "QNT",
                "ЦЕНА ИЗГОТОВИТЕЛЯ": "PRICE1",
                "ЦЕНА РЕАЛИЗАЦИИ": "PRICE2",
                "НДС": "NDS",
                "СУММА": "SUMSTR",
                "СТРАНА ПРОИСХОЖДЕНИЯ": "CNTR",
                "ИЗГОТОВИТЕЛЬ": "FIRM",
                "РЕЕСТРОВАЯ ЦЕНА": "REGPRC"
            }
        },
        "pulse_excel": {
            name: "Пульс — Электронная накладная",
            supplier: "ООО ФК Пульс",
            mapping: {
                "КОД": "CODEPST",
                "EAN": "EAN13",
                "НАИМЕНОВАНИЕ": "NAME",
                "ПАРТИЯ": "SER",
                "СРОК": "GDATE",
                "К-ВО": "QNT",
                "ЦЕНА БЕЗ НАЛОГА": "PRICE2N",
                "ЦЕНА С НАЛОГОМ": "PRICE2",
                "% НДС": "NDS",
                "ИТОГО С НДС": "SUMSTR",
                "ПРОИЗВОДИТЕЛЬ": "FIRM",
                "НОМЕР ГТД": "NUMGTD"
            }
        }
    };

    static getAllPresets() {
        let custom = {};
        try {
            custom = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
        } catch (e) {}
        return { ...this.DEFAULT_PRESETS, ...custom };
    }

    static saveCustomPreset(presetId, name, supplier, mapping) {
        const key = String(presetId).trim().toLowerCase().replace(/[\s-]/g, '_');
        const custom = this.getCustomPresets();
        custom[key] = { name, supplier, mapping };
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(custom));
            return true;
        } catch (e) {
            return false;
        }
    }

    static getCustomPresets() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || "{}");
        } catch (e) {
            return {};
        }
    }
}