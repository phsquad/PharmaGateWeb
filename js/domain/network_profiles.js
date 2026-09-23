/**
 * js/domain/network_profiles.js - Профили сетей РФ и многофакторный скоринг.
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { getNaklSchema } from './models.js';

export const NETWORK_PROFILES = {
    "neofarm": {
        title: "🏥 НЕО-ФАРМ / Солнечные Аптеки",
        targetEncoding: "cp866",
        langByte: 0x26,
        description: "Пустой SUBJID при отсутствии МДЛП, автозамена пустых ГТД на 'б/гтд'.",
        filenamePattern: "nakl_{NDOC}_{DATEDOC}.dbf",
        cleanSubjidGuid: true,
        gtdDomesticFallback: true
    },
    "rigla": {
        title: "🏥 Ригла / Будь Здоров / Живика",
        targetEncoding: "cp866",
        langByte: 0x26,
        description: "Точность сумм SUMSTR = QNT * PRICE2 строго 2 знака, синхронизация шапки.",
        filenamePattern: "nakl_{NDOC}_{DATEDOC}.dbf",
        strictMath: true
    },
    "katren": {
        title: "🏥 Катрен / Аптека.ру",
        targetEncoding: "cp866",
        langByte: 0x26,
        description: "Обязательное присутствие Триады Катрена: серия SER, срок GDATE и цена изготовителя PRICE1.",
        filenamePattern: "nakl_{NDOC}_{DATEDOC}.dbf",
        requireTriad: true
    },
    "pharm366": {
        title: "🏥 36.6 / Горздрав / A.v.e",
        targetEncoding: "cp866",
        langByte: 0x26,
        description: "Формат дат строго YYYYMMDD, проверка контрольных сумм GTIN-14, санация кавычек.",
        filenamePattern: "nakl_{NDOC}_{DATEDOC}.dbf"
    },
    "april": {
        title: "🏥 Аптечная Сеть «Апрель»",
        targetEncoding: "cp866",
        langByte: 0x26,
        description: "Строгий формат имени файла {PODRCD}_{NDOC}.dbf.",
        filenamePattern: "{PODRCD}_{NDOC}.dbf"
    },
    "universal_1251": {
        title: "🌐 Универсальный (Windows CP1251)",
        targetEncoding: "windows-1251",
        langByte: 0x25,
        description: "Кодировка ANSI (CP1251) для прямого импорта в 1С:Предприятие 7.7 / 8.3.",
        filenamePattern: "nakl_{NDOC}_{DATEDOC}.dbf"
    }
};

export class ProfileManager {
    static getProfile(key = "neofarm") {
        return NETWORK_PROFILES[key] || NETWORK_PROFILES["neofarm"];
    }

    static detectBestProfile(headers, records, metaHeader = {}) {
        const rcvInn = String(metaHeader.RCV_INN || (records[0] ? records[0].RCV_INN : '') || '').trim();
        const rcvName = String(metaHeader.RCV_NAME || (records[0] ? records[0].RCV_NAME : '') || '').toLowerCase();

        if (rcvInn === "7734123456" || rcvName.includes("нео-фарм") || rcvName.includes("солнечные")) return "neofarm";
        if (rcvInn === "7724211234" || rcvName.includes("ригла") || rcvName.includes("живика")) return "rigla";
        if (rcvInn === "7705123456" || rcvName.includes("36.6") || rcvName.includes("горздрав")) return "pharm366";
        if (rcvName.includes("апрель")) return "april";
        if (rcvName.includes("катрен")) return "katren";

        const podrcd = String(records[0] ? records[0].PODRCD : '').toUpperCase();
        if (podrcd.startsWith('APR_')) return "april";
        if (podrcd.startsWith('366_') || podrcd.startsWith('GZ_')) return "pharm366";

        return "neofarm";
    }
}