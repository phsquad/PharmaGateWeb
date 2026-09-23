/**
 * js/services/export_service.js - Генерация официальных печатных форм ТОРГ-12 Excel и XML УПД 970@.
 * 
 * Включает:
 * - Генератор денежных сумм и количеств прописью на русском языке до триллионов рублей;
 * - Промышленный генератор унифицированной формы ТОРГ-12 (ОКУД 0330212) в Excel через SheetJS;
 * - Генератор титула продавца СЧФДОП XML УПД (Приказ ФНС РФ № ЕД-7-26/970@, КНД 1115131) в Windows-1251;
 * - Сохранение регистра Base62 для КИЗов маркировки DataMatrix и упаковку фармацевтической матрицы <ТекстИнф>.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { DataMatrixParser, EncodingGuard } from '../engine/text_engine.js';

// =========================================================================
// 1. ПЕРЕВОД ДЕНЕЖНЫХ СУММ И КОЛИЧЕСТВА В ПРОПИСЬ НА РУССКОМ ЯЗЫКЕ
// =========================================================================

/**
 * Преобразует денежную сумму в грамматически корректную пропись на русском языке
 * @param {number|string} amount - Денежная сумма (например, 17000.50)
 * @returns {string} - "Семнадцать тысяч рублей 50 копеек"
 */
export function amountInWordsRu(amount) {
    const num = Math.abs(parseFloat(amount) || 0);
    const rubles = Math.floor(num);
    const kopecks = Math.round((num - rubles) * 100);

    const units = [
        ["", ""], ["один", "одна"], ["два", "две"], ["три", "три"], ["четыре", "четыре"],
        ["пять", "пять"], ["шесть", "шесть"], ["семь", "семь"], ["восемь", "восемь"], ["девять", "девять"]
    ];
    const teens = [
        "десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать",
        "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"
    ];
    const tens = [
        "", "", "двадцать", "тридцать", "сорок", "пятьдесят",
        "шестьдесят", "семьдесят", "восемьдесят", "девяносто"
    ];
    const hundreds = [
        "", "сто", "двести", "триста", "четыреста",
        "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"
    ];

    function declension(n, titles) {
        const absN = Math.abs(n) % 100;
        const n1 = absN % 10;
        if (absN > 10 && absN < 20) return titles[2];
        if (n1 > 1 && n1 < 5) return titles[1];
        if (n1 === 1) return titles[0];
        return titles[2];
    }

    if (rubles === 0) {
        return `Ноль рублей ${String(kopecks).padStart(2, '0')} копеек`;
    }

    const scales = [
        [1000000000000, ["триллион", "триллиона", "триллионов"], 0],
        [1000000000, ["миллиард", "миллиарда", "миллиардов"], 0],
        [1000000, ["миллион", "миллиона", "миллионов"], 0],
        [1000, ["тысяча", "тысячи", "тысяч"], 1]
    ];

    let val = rubles;
    const parts = [];

    scales.forEach(([scale, titles, gender]) => {
        if (val >= scale) {
            const count = Math.floor(val / scale);
            val %= scale;

            const h = Math.floor(count / 100);
            const t = Math.floor((count % 100) / 10);
            const u = count % 10;

            if (h) parts.push(hundreds[h]);
            if (t === 1) {
                parts.push(teens[u]);
            } else {
                if (t) parts.push(tens[t]);
                if (u) parts.push(units[u][gender]);
            }
            parts.push(declension(count, titles));
        }
    });

    const h = Math.floor(val / 100);
    const t = Math.floor((val % 100) / 10);
    const u = val % 10;

    if (h) parts.push(hundreds[h]);
    if (t === 1) {
        parts.push(teens[u]);
    } else {
        if (t) parts.push(tens[t]);
        if (u) parts.push(units[u][0]);
    }

    const rublesStr = parts.join(' ').trim();
    const capitalized = rublesStr.charAt(0).toUpperCase() + rublesStr.slice(1);
    const rubDecl = declension(rubles, ["рубль", "рубля", "рублей"]);
    const kopDecl = declension(kopecks, ["копейка", "копейки", "копеек"]);

    return `${capitalized} ${rubDecl} ${String(kopecks).padStart(2, '0')} ${kopDecl}`;
}

/**
 * Перевод целого количества порядковых номеров строк в пропись
 * @param {number} countNum 
 * @returns {string}
 */
export function quantityInWordsRu(countNum) {
    const num = parseInt(countNum, 10) || 0;
    if (num === 0) return "ноль";

    const numMap = {
        1: "одно", 2: "два", 3: "три", 4: "четыре", 5: "пять",
        6: "шесть", 7: "семь", 8: "восемь", 9: "девять", 10: "десять",
        11: "одиннадцать", 12: "двенадцать", 13: "тринадцать", 14: "четырнадцать", 15: "пятнадцать",
        16: "шестнадцать", 17: "семнадцать", 18: "восемнадцать", 19: "девятнадцать",
        20: "двадцать", 30: "тридцать", 40: "сорок", 50: "пятьдесят"
    };

    if (numMap[num]) return numMap[num];
    return String(num);
}

// =========================================================================
// 2. ГЕНЕРАТОР ОФИЦИАЛЬНОЙ НАКЛАДНОЙ ТОРГ-12 В EXCEL (ОКУД 0330212)
// =========================================================================

export class Torg12ExcelGenerator {
    /**
     * Формирует и инициирует прямое скачивание официального Excel-файла ТОРГ-12
     * @param {Array<Object>} records - Строки номенклатуры
     * @param {Object} headerInfo - Реквизиты шапки (поставщик, покупатель, договор, дата)
     * @param {string} fileName - Имя выходного файла
     */
    static generate(records, headerInfo = {}, fileName = "") {
        if (!window.XLSX) {
            throw new Error("Библиотека SheetJS (xlsx.full.min.js) не подключена.");
        }

        const supplierName = headerInfo.supplierName || 'ООО «Поставщик»';
        const buyerName = headerInfo.buyerName || 'ООО «Аптечная Сеть»';
        const ndoc = String(headerInfo.ndoc || (records[0] ? records[0].NDOC : '1') || '1').trim();
        const datedoc = headerInfo.datedoc || (records[0] ? records[0].DATEDOC : new Date()) || new Date();
        const dateFormatted = DateEngine.formatForUI(datedoc);
        const contractNum = headerInfo.contractNum || 'ДОГ-2026/01';

        const wsData = [
            ["", "", "", "", "", "", "", "", "", "Унифицированная форма № ТОРГ-12"],
            ["", "", "", "", "", "", "", "", "", "Утверждена постановлением Госкомстата России"],
            ["", "", "", "", "", "", "", "", "", "от 25.12.98 № 132 | Код по ОКУД 0330212"],
            [],
            [`Грузоотправитель: ${supplierName}`],
            [`Поставщик: ${supplierName}`],
            [`Грузополучатель: ${buyerName}`],
            [`Плательщик: ${buyerName}`],
            [`Основание: Договор поставки № ${contractNum} от ${dateFormatted}`],
            [],
            [`ТОВАРНАЯ НАКЛАДНАЯ (ТОРГ-12) № ${ndoc} от ${dateFormatted}`],
            [],
            [
                "№", "Код товара", "Наименование медикамента, характеристика", "Серия",
                "Срок годн.", "Кол-во (шт)", "Цена без НДС", "Цена с НДС", "Ставка НДС", "Сумма НДС", "Всего с НДС"
            ]
        ];

        let totalSum = 0.0;
        let totalNds = 0.0;
        let totalSumNoNds = 0.0;
        let totalQnt = 0.0;

        records.forEach((r, idx) => {
            const qnt = PharmaMath.cleanDecimal(r.QNT, 1.0);
            const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
            const p2n = PharmaMath.cleanDecimal(r.PRICE2N, 0.0);
            const ndsVal = r.NDS !== undefined ? r.NDS : 10;

            let sumstr = PharmaMath.cleanDecimal(r.SUMSTR, 0.0);
            let sumsnds = PharmaMath.cleanDecimal(r.SUMSNDS, 0.0);

            if (sumstr <= 0 && qnt > 0 && p2 > 0) {
                const fin = PharmaMath.calculateLine(qnt, p2, ndsVal);
                sumstr = fin.sumstr;
                sumsnds = fin.sumsnds;
            }

            const sumNoNds = PharmaMath.roundMoney(sumstr - sumsnds);

            totalQnt += qnt;
            totalSum += sumstr;
            totalNds += sumsnds;
            totalSumNoNds += sumNoNds;

            const gDateFormatted = DateEngine.formatForUI(r.GDATE, "б/срок");

            wsData.push([
                idx + 1,
                EncodingGuard.sanitizeCodepstProtek(r.CODEPST),
                EncodingGuard.sanitizeText366(r.NAME || `Товар ${idx + 1}`),
                String(r.SER || 'б/с').trim(),
                gDateFormatted,
                qnt,
                p2n,
                p2,
                `${ndsVal}%`,
                sumsnds,
                sumstr
            ]);
        });

        // Строка Итого
        wsData.push([
            "", "", "ИТОГО ПО НАКЛАДНОЙ:", "", "",
            PharmaMath.roundMoney(totalQnt),
            "", "", "",
            PharmaMath.roundMoney(totalNds),
            PharmaMath.roundMoney(totalSum)
        ]);

        wsData.push([]);
        const sumInWords = amountInWordsRu(totalSum);
        const qntInWords = quantityInWordsRu(records.length);

        wsData.push([`Товарная накладная содержит ${records.length} (${qntInWords}) порядковых номеров записей.`]);
        wsData.push([`Всего отпущено наименований ${records.length}, на сумму: ${sumInWords}`]);
        wsData.push([]);
        wsData.push(["Отпуск груза разрешил: ___________________ (Руководитель)", "", "", "", "", "", "Груз принял (Аптека): ___________________ (МОЛ)"]);
        wsData.push(["Главный бухгалтер: ___________________", "", "", "", "", "", "Груз получил грузополучатель: ___________________"]);
        wsData.push(["Отпуск груза произвел: ___________________ (Зав. складом)", "", "", "", "", "", `М.П. от «___» ____________ 2026 г.`]);

        // Создание рабочей книги SheetJS
        const wb = window.XLSX.utils.book_new();
        const ws = window.XLSX.utils.aoa_to_sheet(wsData);

        // Настройка ширины колонок
        ws['!cols'] = [
            { wch: 5 },  // №
            { wch: 14 }, // Код товара
            { wch: 46 }, // Наименование
            { wch: 14 }, // Серия
            { wch: 12 }, // Срок
            { wch: 12 }, // Кол-во
            { wch: 14 }, // Цена без НДС
            { wch: 14 }, // Цена с НДС
            { wch: 12 }, // Ставка НДС
            { wch: 14 }, // Сумма НДС
            { wch: 16 }  // Всего с НДС
        ];

        const sheetTitle = `ТОРГ-12 №${ndoc}`.slice(0, 31);
        window.XLSX.utils.book_append_sheet(wb, ws, sheetTitle);

        const outName = fileName || `ТОРГ12_№${ndoc}_${DateEngine.formatForDBF(datedoc)}.xlsx`;
        window.XLSX.writeFile(wb, outName);
        return true;
    }
}

// =========================================================================
// 3. ГЕНЕРАТОР XML УПД 970@ (ПРИКАЗ ФНС № ЕД-7-26/970@, WINDOWS-1251)
// =========================================================================

export class UpdFns970Generator {
    /**
     * Генерация канонического XML-файла УПД (функция СЧФДОП, КНД 1115131)
     * @param {Array<Object>} records - Строки накладной
     * @param {Object} metaHeader - Реквизиты продавца и покупателя
     * @returns {{ xmlString: string, fileId: string, arrayBuffer: ArrayBuffer }}
     */
    static generateXml(records, metaHeader = {}) {
        if (!records || records.length === 0) {
            throw new Error("Невозможно сформировать XML УПД: список строк номенклатуры пуст.");
        }

        const ndoc = String(metaHeader.NDOC || (records[0] ? records[0].NDOC : '1') || '1').trim();
        const datedoc = metaHeader.DATEDOC || (records[0] ? records[0].DATEDOC : new Date()) || new Date();
        const docDateIso = DateEngine.parseAnyDate(datedoc) || new Date().toISOString().split('T')[0];
        const [y, m, d] = docDateIso.split('-');
        const docDateFns = `${d}.${m}.${y}`;

        const sellerInn = String(metaHeader.SENDER_INN || '7700123456').replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
        const sellerKpp = String(metaHeader.SENDER_KPP || '770101001').replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
        const sellerName = EncodingGuard.sanitizeText366(metaHeader.SENDER_NAME || 'ООО «Поставщик»');

        const buyerInn = String(metaHeader.RCV_INN || '7711987654').replace(/\D/g, '').padEnd(10, '0').slice(0, 10);
        const buyerKpp = String(metaHeader.RCV_KPP || '771101001').replace(/\D/g, '').padEnd(9, '0').slice(0, 9);
        const buyerName = EncodingGuard.sanitizeText366(metaHeader.RCV_NAME || 'ООО «Аптечная Сеть»');
        const buyerPodrcd = String(metaHeader.PODRCD || (records[0] ? records[0].PODRCD : '001') || '001').trim();

        const contractNum = String(metaHeader.CONTRACT_NUM || 'ДОГ-2026/01').trim();
        const contractDateFns = metaHeader.CONTRACT_DATE ? DateEngine.formatForUI(metaHeader.CONTRACT_DATE) : docDateFns;

        // Генерация GUID и ИдФайл ФНС: ON_NSCHFDOPPR_{ИдПолуч}_{ИдОтпр}_{Дата}_{GUID}
        const guid = (crypto.randomUUID ? crypto.randomUUID() : 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890').toUpperCase();
        const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const fileId = `ON_NSCHFDOPPR_${buyerInn}_${sellerInn}_${todayStr}_${guid}`;

        let totalSumWithNds = 0.0;
        let totalNds = 0.0;
        let totalSumNoNds = 0.0;

        let tableRowsXml = '';

        records.forEach((r, idx) => {
            const rowNum = idx + 1;
            const qnt = PharmaMath.cleanDecimal(r.QNT, 1.0);
            const p2 = PharmaMath.cleanDecimal(r.PRICE2, 0.0);
            const p2n = PharmaMath.cleanDecimal(r.PRICE2N, 0.0);
            const ndsVal = r.NDS !== undefined ? parseInt(r.NDS, 10) : 10;
            const ndsRateStr = ndsVal === 0 ? "0%" : (ndsVal === 20 ? "20%" : "10%");

            let sumstr = PharmaMath.cleanDecimal(r.SUMSTR, 0.0);
            let sumsnds = PharmaMath.cleanDecimal(r.SUMSNDS, 0.0);

            if (sumstr <= 0 && qnt > 0 && p2 > 0) {
                const fin = PharmaMath.calculateLine(qnt, p2, ndsVal);
                sumstr = fin.sumstr;
                sumsnds = fin.sumsnds;
            }

            const sumNoNds = PharmaMath.roundMoney(sumstr - sumsnds);

            totalSumWithNds += sumstr;
            totalNds += sumsnds;
            totalSumNoNds += sumNoNds;

            const nameSanitized = EncodingGuard.sanitizeText366(r.NAME || `Товар ${rowNum}`);
            const codePst = EncodingGuard.sanitizeCodepstProtek(r.CODEPST || `${rowNum}`);
            const serVal = String(r.SER || 'б/с').trim();
            const gDateIso = DateEngine.parseAnyDate(r.GDATE) || "";
            const dMadeIso = DateEngine.parseAnyDate(r.DATEMADE) || "";
            const numGtdVal = String(r.NUMGTD || 'б/гтд').trim();
            const regPrcVal = PharmaMath.cleanDecimal(r.REGPRC, 0.0);
            const p1Val = PharmaMath.cleanDecimal(r.PRICE1, 0.0);

            // Разбор КИЗов маркировки DataMatrix
            let kizXml = '';
            const rawCisArray = r.RAW_CIS_ARRAY || [];
            const gtinVal = String(r.GTIN || '').trim();

            if (Array.isArray(rawCisArray) && rawCisArray.length > 0) {
                kizXml = '<НомСредИдент>';
                rawCisArray.forEach(c => {
                    const parsed = DataMatrixParser.parse(c);
                    if (parsed.isValid && parsed.fullKiz) {
                        kizXml += `<КИЗ>${parsed.fullKiz}</КИЗ>`;
                    }
                });
                kizXml += '</НомСредИдент>';
            } else if (gtinVal && gtinVal.length === 14) {
                const serPadded = serVal.padEnd(13, '0').slice(0, 13);
                kizXml = `<НомСредИдент><КИЗ>01${gtinVal}21${serPadded}</КИЗ></НомСредИдент>`;
            }

            tableRowsXml += `
      <СведТов НомСтр="${rowNum}" НаимТов="${nameSanitized}" ОКЕИ_Тов="796" КолТов="${qnt.toFixed(3)}" ЦенаТов="${p2n.toFixed(2)}" СтТовБезНДС="${sumNoNds.toFixed(2)}" НалСт="${ndsRateStr}" СумНал="${sumsnds.toFixed(2)}" СтТовУчНал="${sumstr.toFixed(2)}">
        <Акциз><БезАкциз>без акциза</БезАкциз></Акциз>
        <ДопСведТов НомСтр="${rowNum}" НаимТов="${nameSanitized}" ПрТовРаб="1" КодТов="${codePst}">
          ${kizXml}
          <ТекстИнф ИдентТекст="PRICE1" ЗначТекст="${p1Val.toFixed(2)}"/>
          <ТекстИнф ИдентТекст="SER" ЗначТекст="${serVal}"/>
          <ТекстИнф ИдентТекст="GDATE" ЗначТекст="${gDateIso}"/>
          <ТекстИнф ИдентТекст="PODRCD" ЗначТекст="${buyerPodrcd}"/>
          ${dMadeIso ? `<ТекстИнф ИдентТекст="DATEMADE" ЗначТекст="${dMadeIso}"/>` : ''}
          ${numGtdVal && numGtdVal !== 'б/гтд' ? `<ТекстИнф ИдентТекст="NUMGTD" ЗначТекст="${numGtdVal}"/>` : ''}
          ${regPrcVal > 0 ? `<ТекстИнф ИдентТекст="PRICE_REG" ЗначТекст="${regPrcVal.toFixed(2)}"/>` : ''}
        </ДопСведТов>
      </СведТов>`;
        });

        const totalSumFormatted = PharmaMath.roundMoney(totalSumWithNds).toFixed(2);
        const totalNdsFormatted = PharmaMath.roundMoney(totalNds).toFixed(2);
        const totalSumNoNdsFormatted = PharmaMath.roundMoney(totalSumNoNds).toFixed(2);

        const xmlString = `<?xml version="1.0" encoding="windows-1251"?>
<Файл ИдФайл="${fileId}" ВерсПрог="PharmaGate EDI Pro 2026" ВерсФорм="5.02">
  <СвУчДокОбор ИдОтпр="${sellerInn}" ИдПолуч="${buyerInn}"/>
  <Документ КНД="1115131" Функция="СЧФДОП" ПорядНомСчФ="${ndoc}" ДатаСчФ="${docDateFns}" ВремяСчФ="${new Date().toLocaleTimeString('ru-RU')}" ВидОперации="ПродажаЛП">
    <СвСчФакт>
      <СвПрод>
        <ИдСв>
          <СвЮЛУч НаимОрг="${sellerName}" ИННЮЛ="${sellerInn}" КПП="${sellerKpp}"/>
        </ИдСв>
        <Адрес>
          <АдрРФ КодРегион="77" АдрТекст="г. Москва, ул. Центральная, д. 1"/>
        </Адрес>
      </СвПрод>
      <СвПокуп>
        <ИдСв>
          <СвЮЛУч НаимОрг="${buyerName}" ИННЮЛ="${buyerInn}" КПП="${buyerKpp}"/>
        </ИдСв>
        <Адрес>
          <АдрРФ КодРегион="77" АдрТекст="г. Москва, ул. Аптечная, д. 10"/>
        </Адрес>
      </СвПокуп>
    </СвСчФакт>
    <ТаблСчФакт>${tableRowsXml}
      <ВсегоОпл СтТовБезНДСВсего="${totalSumNoNdsFormatted}" СумНалВсего="${totalNdsFormatted}" СтТовУчНалВсего="${totalSumFormatted}"/>
    </ТаблСчФакт>
    <ОснДоверОргСост>
      <ОснСчФ НаимОсн="Договор поставки" НомОсн="${contractNum}" ДатаОсн="${contractDateFns}"/>
    </ОснДоверОргСост>
    <Подписант ОблПолномоч="3" Статус="1" ОснПолн="Должностные обязанности">
      <ЮЛ ИННЮЛ="${sellerInn}" НаимОрг="${sellerName}" Должн="Генеральный директор">
        <ФИО Фамилия="Иванов" Имя="Иван" Отчество="Иванович"/>
      </ЮЛ>
    </Подписант>
  </Документ>
</Файл>`;

        return {
            xmlString,
            fileId,
            arrayBuffer: this.encodeToWindows1251(xmlString)
        };
    }

    /**
     * Кодирует Юникод-строку XML в бинарный буфер Windows-1251
     * @param {string} str 
     * @returns {ArrayBuffer}
     */
    static encodeToWindows1251(str) {
        const buf = new ArrayBuffer(str.length);
        const bytes = new Uint8Array(buf);

        for (let i = 0; i < str.length; i++) {
            const code = str.charCodeAt(i);
            if (code < 128) {
                bytes[i] = code;
            } else if (code >= 0x0410 && code <= 0x044F) {
                // А-Я, а-я в Windows-1251 смещены на (0x0410 - 192)
                bytes[i] = code - 0x0410 + 192;
            } else if (code === 0x0401) {
                bytes[i] = 168; // Ё
            } else if (code === 0x0451) {
                bytes[i] = 184; // ё
            } else if (code === 0x2116) {
                bytes[i] = 78;  // № -> N
            } else if (code === 0x00AB || code === 0x00BB) {
                bytes[i] = 34;  // « » -> "
            } else if (code === 0x2014 || code === 0x2013) {
                bytes[i] = 45;  // — -> -
            } else {
                bytes[i] = 63;  // '?'
            }
        }
        return buf;
    }

    /**
     * Запуск скачивания сгенерированного XML УПД 970@ в браузере
     */
    static downloadXml(records, metaHeader = {}) {
        const { arrayBuffer, fileId } = this.generateXml(records, metaHeader);
        const blob = new Blob([arrayBuffer], { type: 'application/xml;charset=windows-1251' });
        const link = document.createElement('a');
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = `${fileId}.xml`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }
}