/**
 * js/domain/models.js - Канонические структуры данных, схемы NAKL, ORDER, OTKAZ, UPD.
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class FieldRule {
    constructor(name, type, length, decimal = 0, required = false, userName = "", defaultValue = null, synonyms = []) {
        this.name = name.toUpperCase();
        this.type = type.toUpperCase();
        this.length = length;
        this.decimal = decimal;
        this.required = required;
        this.userName = userName || name;
        this.defaultValue = defaultValue;
        this.synonyms = synonyms.map(s => s.toUpperCase());
    }
}

export class DocumentSchema {
    constructor(name, title, headerFields, fields) {
        this.name = name;
        this.title = title;
        this.headerFields = headerFields;
        this.fields = fields;
    }
}

export class ValidationIssue {
    constructor(severity, field, rowIndex, userText, techText, code = "ERR_GENERAL", fixable = true) {
        this.severity = severity; // 'CRITICAL', 'WARNING', 'INFO'
        this.field = field;
        this.rowIndex = rowIndex;
        this.userText = userText;
        this.techText = techText;
        this.code = code;
        this.fixable = fixable;
    }
}

export function getNaklSchema() {
    return new DocumentSchema(
        "nakl",
        "Приходная накладная поставщика (NAKL)",
        ["NDOC", "DATEDOC", "PODRCD", "BILLNUM", "BILLDT", "DATEZ", "NUMZ"],
        [
            new FieldRule("NDOC", "C", 20, 0, true, "Номер накладной", "1", ["NDOC", "НОМЕР НАКЛАДНОЙ", "№ ДОК"]),
            new FieldRule("DATEDOC", "D", 8, 0, true, "Дата накладной", null, ["DATEDOC", "ДАТА НАКЛАДНОЙ"]),
            new FieldRule("CODEPST", "C", 36, 0, true, "Артикул поставщика", "000001", ["CODEPST", "АРТИКУЛ", "КОД ТОВАРА"]),
            new FieldRule("EAN13", "C", 13, 0, true, "Штрихкод EAN-13", "", ["EAN13", "ШТРИХКОД", "BARCODE"]),
            new FieldRule("PRICE1", "N", 15, 2, true, "Цена изготовителя", 0.0, ["PRICE1", "ЦЕНА ИЗГОТОВИТЕЛЯ"]),
            new FieldRule("PRICE2", "N", 15, 2, true, "Цена отпускная с НДС", 0.0, ["PRICE2", "ЦЕНА С НДС", "ЦЕНА"]),
            new FieldRule("PRICE2N", "N", 15, 2, true, "Цена без НДС", 0.0, ["PRICE2N", "ЦЕНА БЕЗ НДС"]),
            new FieldRule("QNT", "N", 9, 2, true, "Количество", 1.0, ["QNT", "КОЛИЧЕСТВО", "КОЛ-ВО"]),
            new FieldRule("SER", "C", 25, 0, true, "Серия партии", "б/с", ["SER", "СЕРИЯ", "ПАРТИЯ"]),
            new FieldRule("GDATE", "D", 8, 0, true, "Срок годности", null, ["GDATE", "СРОК ГОДНОСТИ", "ГОДЕН ДО"]),
            new FieldRule("DATEMADE", "D", 8, 0, false, "Дата выпуска", null, ["DATEMADE", "ДАТА ВЫПУСКА"]),
            new FieldRule("NAME", "C", 250, 0, true, "Наименование препарата", "", ["NAME", "НАИМЕНОВАНИЕ", "ТОВАР"]),
            new FieldRule("CNTR", "C", 150, 0, true, "Страна происхождения", "Россия", ["CNTR", "СТРАНА"]),
            new FieldRule("FIRM", "C", 250, 0, false, "Фирма-изготовитель", "-", ["FIRM", "ПРОИЗВОДИТЕЛЬ"]),
            new FieldRule("NDS", "N", 3, 0, false, "Ставка НДС %", 10, ["NDS", "НДС", "СТАВКА НДС"]),
            new FieldRule("REGPRC", "N", 9, 2, false, "Реестровая цена ЖНВЛП", 0.0, ["REGPRC", "ЖНВЛП"]),
            new FieldRule("NUMGTD", "C", 30, 0, true, "Номер ГТД / РУ", "б/гтд", ["NUMGTD", "ГТД", "РУ"]),
            new FieldRule("SERTIF", "C", 180, 0, false, "Сертификат / РУ", "-", ["SERTIF", "СЕРТИФИКАТ"]),
            new FieldRule("SUMSTR", "N", 15, 2, true, "Сумма с НДС", 0.0, ["SUMSTR", "СУММА С НДС", "ВСЕГО"]),
            new FieldRule("PODRCD", "C", 25, 0, true, "Код аптеки", "001", ["PODRCD", "КОД АПТЕКИ"]),
            new FieldRule("BILLNUM", "C", 20, 0, true, "Номер с/ф", "1", ["BILLNUM", "НОМЕР С/Ф"]),
            new FieldRule("BILLDT", "D", 8, 0, true, "Дата с/ф", null, ["BILLDT", "ДАТА С/Ф"]),
            new FieldRule("NUMZ", "N", 12, 0, true, "Номер заказа", 1, ["NUMZ", "НОМЕР ЗАКАЗА"]),
            new FieldRule("DATEZ", "D", 8, 0, true, "Дата заказа", null, ["DATEZ", "ДАТА ЗАКАЗА"]),
            new FieldRule("SUMSNDS", "N", 15, 2, true, "Сумма НДС", 0.0, ["SUMSNDS", "СУММА НДС"]),
            new FieldRule("MARK", "N", 1, 0, false, "Маркировка (0/1)", 0, ["MARK", "МДЛП"]),
            new FieldRule("GTIN", "C", 14, 0, false, "GTIN-14", "", ["GTIN", "ГТИН"]),
            new FieldRule("SUBJID", "C", 36, 0, false, "SUBJID МДЛП", "", ["SUBJID", "СУБЪЕКТ МДЛП"])
        ]
    );
}