/**
 * js/engine/date_engine.js - Хронометрический движок дат.
 * Обеспечивает:
 * - Строгий парсинг без заглушек 1990/1900 гг. (Strict Null Enforcement);
 * - Конвертацию серийных чисел Excel (например, 45517 -> 2024-08-13);
 * - Расчет срока годности без потери дней конца месяца (31.08 -> 28.02);
 * - Форматирование в YYYYMMDD или 8 пробелов для DBF.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

export class DateEngine {
    static EXCEL_BASE_EPOCH = new Date(1899, 11, 30); // 1899-12-30

    static DUMMY_DATE_STRINGS = new Set([
        '1990-01-01', '19900101', '01.01.1990', '01/01/1990',
        '1900-01-01', '19000101', '01.01.1900', '01/01/1900',
        '1899-12-30', '18991230', '30.12.1899', '00000000',
        '00.00.0000', '0000-00-00', '1980-01-01', '01.01.1980'
    ]);

    static RU_MONTHS = {
        'янв': 1, 'фев': 2, 'мар': 3, 'апр': 4, 'май': 5, 'мая': 5,
        'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'окт': 10, 'ноя': 11, 'дек': 12
    };

    static parseAnyDate(val, defaultVal = null) {
        if (!val) return defaultVal;

        if (val instanceof Date && !isNaN(val.getTime())) {
            const y = val.getFullYear();
            if (y <= 1990 || y >= 2090) return defaultVal;
            return val.toISOString().split('T')[0];
        }

        if (typeof val === 'number') {
            if (val >= 34000 && val <= 70000) {
                const targetMs = this.EXCEL_BASE_EPOCH.getTime() + val * 86400000;
                const d = new Date(targetMs);
                return this.parseAnyDate(d, defaultVal);
            }
        }

        const s = String(val).trim();
        if (!s || this.DUMMY_DATE_STRINGS.has(s.toLowerCase())) {
            return defaultVal;
        }

        // Серийное число Excel в виде строки
        if (/^\d{5}(?:\.0+)?$/.test(s)) {
            const num = parseFloat(s);
            if (num >= 34000 && num <= 70000) {
                const d = new Date(this.EXCEL_BASE_EPOCH.getTime() + num * 86400000);
                return this.parseAnyDate(d, defaultVal);
            }
        }

        // YYYYMMDD
        if (/^\d{8}$/.test(s)) {
            const y = parseInt(s.slice(0, 4), 10);
            const m = parseInt(s.slice(4, 6), 10);
            const d = parseInt(s.slice(6, 8), 10);
            if (y > 1990 && y < 2090 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        // DD.MM.YYYY или DD/MM/YYYY или YYYY-MM-DD
        const sepMatch = s.match(/^(\d{1,4})[./-](\d{1,2})[./-](\d{1,4})/);
        if (sepMatch) {
            let p1 = parseInt(sepMatch[1], 10);
            let p2 = parseInt(sepMatch[2], 10);
            let p3 = parseInt(sepMatch[3], 10);

            let y, m, d;
            if (p1 > 1900) {
                y = p1; m = p2; d = p3;
            } else {
                d = p1; m = p2; y = (p3 < 100) ? 2000 + p3 : p3;
            }

            if (y > 1990 && y < 2090 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }

        return defaultVal;
    }

    static formatForUI(val, fallback = "") {
        const iso = this.parseAnyDate(val);
        if (!iso) return fallback;
        const [y, m, d] = iso.split('-');
        return `${d}.${m}.${y}`;
    }

    static formatForDBF(val) {
        const iso = this.parseAnyDate(val);
        if (!iso) return "        "; // 8 пробелов
        return iso.replace(/-/g, '').slice(0, 8);
    }

    static calculateExpiryDate(mfgDate, validityMonths = 24) {
        const iso = this.parseAnyDate(mfgDate);
        if (!iso) return null;

        const [year, month, day] = iso.split('-').map(Number);
        let targetYear = year + Math.floor((month - 1 + validityMonths) / 12);
        let targetMonth = ((month - 1 + validityMonths) % 12) + 1;

        const maxDay = new Date(targetYear, targetMonth, 0).getDate();
        let targetDay = Math.min(day, maxDay);

        return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
    }

    static getDaysLeft(expiryDate) {
        const iso = this.parseAnyDate(expiryDate);
        if (!iso) return 0;
        const exp = new Date(iso).getTime();
        const now = new Date().setHours(0, 0, 0, 0);
        return Math.floor((exp - now) / 86400000);
    }
}