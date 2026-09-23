/**
 * js/domain/pharma_vocab.js - Канонический фармацевтический тезаурус и реестр филиалов аптек РФ.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class PharmacyBranch {
    constructor(networkKey, podrcd, name, address, subjid = "", inn = "", kpp = "") {
        this.networkKey = networkKey;
        this.podrcd = podrcd;
        this.name = name;
        this.address = address;
        this.subjid = subjid;
        this.inn = inn;
        this.kpp = kpp;
    }
}

export class PharmaVocabulary {
    static PHARMACY_BRANCHES = [
        // НЕО-ФАРМ / Солнечные Аптеки
        new PharmacyBranch("neofarm", "771069", "Аптека НЕО-ФАРМ №1069", "г. Москва, ул. Арбат, д. 24", "", "7734123456", "773401001"),
        new PharmacyBranch("neofarm", "771082", "Аптека НЕО-ФАРМ №1082", "г. Москва, пр-кт Мира, д. 112", "", "7734123456", "773401001"),
        new PharmacyBranch("neofarm", "501015", "Солнечные Аптеки №15", "Московская обл., г. Красногорск, ул. Ленина, д. 5", "", "7734123456", "502401001"),

        // Ригла / Будь Здоров! / Живика
        new PharmacyBranch("rigla", "001", "Аптека Ригла №1", "г. Москва, ул. Тверская, д. 12", "00000000-0000-0000-0000-000000000001", "7724211234", "772401001"),
        new PharmacyBranch("rigla", "045", "Будь Здоров! №45", "г. Москва, Ленинградский пр-кт, д. 62", "00000000-0000-0000-0000-000000000045", "7724211234", "772401001"),
        new PharmacyBranch("rigla", "112", "Живика №112", "г. Екатеринбург, ул. Малышева, д. 31", "00000000-0000-0000-0000-000000000112", "6658211234", "665801001"),

        // 36.6 / Горздрав
        new PharmacyBranch("pharm366", "366_01", "Аптека 36.6 Центр", "г. Москва, Кутузовский пр-кт, д. 18", "36600000-0000-0000-0000-000000000001", "7705123456", "770501001"),
        new PharmacyBranch("pharm366", "GZ_204", "Горздрав №204", "г. Москва, ул. Профсоюзная, д. 56", "36600000-0000-0000-0000-000000000204", "7705123456", "770501001"),

        // Апрель
        new PharmacyBranch("april", "APR_7701", "Аптека Апрель №7701", "г. Краснодар, ул. Красная, д. 100", "", "2310123456", "231001001"),
        new PharmacyBranch("april", "APR_7702", "Аптека Апрель №7702", "г. Ростов-на-Дону, ул. Большая Садовая, д. 45", "", "2310123456", "616401001"),

        // СберЕаптека
        new PharmacyBranch("eapteka", "EAP_001", "Хаб СберЕаптека Москва Юг", "г. Москва, Варшавское ш., д. 125", "eap00000-0000-0000-0000-000000000001", "7714123456", "771401001"),

        // Вита
        new PharmacyBranch("vita", "VIT_101", "Вита Экспресс №101", "г. Самара, ул. Победы, д. 14", "", "6316123456", "631601001"),

        // Магнит Аптека
        new PharmacyBranch("magnit", "MGT_001", "Магнит Аптека №1", "г. Краснодар, ул. Солнечная, д. 15/5", "", "2310031475", "231001001")
    ];

    static COUNTRIES_MAP = {
        'россия': 'Россия', 'рф': 'Россия', 'российская федерация': 'Россия', 'russia': 'Россия', 'rus': 'Россия',
        'беларусь': 'Беларусь', 'рб': 'Беларусь', 'belarus': 'Беларусь',
        'германия': 'Германия', 'germany': 'Германия', 'deu': 'Германия',
        'франция': 'Франция', 'france': 'Франция', 'fra': 'Франция',
        'италия': 'Италия', 'italy': 'Италия', 'индия': 'Индия', 'india': 'Индия',
        'китай': 'Китай', 'china': 'Китай', 'словения': 'Словения', 'венгрия': 'Венгрия',
        'швейцария': 'Швейцария', 'великобритания': 'Великобритания', 'сша': 'США', 'usa': 'США'
    };

    static DOSAGE_EXPANSION = {
        'таб': 'таблетки', 'табл': 'таблетки', 'таб п/о': 'таблетки покрытые оболочкой',
        'таб п/пл/об': 'таблетки покрытые пленочной оболочкой', 'капс': 'капсулы',
        'р-р': 'раствор', 'р-р д/ин': 'раствор для инъекций', 'р-р д/в/суст': 'раствор для внутрисуставного введения',
        'сусп': 'суспензия', 'амп': 'ампулы', 'фл': 'флакон', 'супп': 'суппозитории',
        'пор': 'порошок', 'спрей наз': 'спрей назальный', 'капли глаз': 'капли глазные'
    };

    static normalizeCountry(rawCountry) {
        if (!rawCountry) return "Россия";
        const clean = String(rawCountry).trim().toLowerCase().replace(/[.,]/g, '');
        return this.COUNTRIES_MAP[clean] || String(rawCountry).trim();
    }

    static standardizeDosageForm(text) {
        if (!text) return "";
        let result = String(text).trim();
        const sortedKeys = Object.keys(this.DOSAGE_EXPANSION).sort((a, b) => b.length - a.length);

        sortedKeys.forEach(abbr => {
            const regex = new RegExp(`\\b${abbr.replace(/\./g, '\\.')}(?:\\b|\\.)`, 'gi');
            result = result.replace(regex, this.DOSAGE_EXPANSION[abbr]);
        });

        return result.replace(/\s+/g, ' ').trim();
    }

    static getBranchesForNetwork(networkKey = "neofarm") {
        if (!networkKey || networkKey === "auto") return this.PHARMACY_BRANCHES;
        return this.PHARMACY_BRANCHES.filter(b => b.networkKey === networkKey);
    }
}