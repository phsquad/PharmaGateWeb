/**
 * js/engine/dbf_engine.js - Кроссплатформенный бинарный потоковый движок dBase III/IV.
 * Соответствует спецификации IBM/Borland dBase III+ 1988:
 * - Байт 0x03 в заголовке;
 * - Системный языковой байт 0x26 (DOS CP866) / 0x25 (Windows CP1251);
 * - 32-байтные дескрипторы полей с 0x00 нуль-терминатором в 10-м байте;
 * - Терминатор таблицы дескрипторов 0x0D (CR);
 * - Маркер активной записи 0x20 / удаленной 0x2A;
 * - Запись 8 пробелов (0x20) для пустых дат (Strict Null);
 * - Терминатор конца файла DOS EOF 0x1A (Ctrl+Z).
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

const CP866_MAP = [
    0x0410, 0x0411, 0x0412, 0x0413, 0x0414, 0x0415, 0x0416, 0x0417,
    0x0418, 0x0419, 0x041A, 0x041B, 0x041C, 0x041D, 0x041E, 0x041F,
    0x0420, 0x0421, 0x0422, 0x0423, 0x0424, 0x0425, 0x0426, 0x0427,
    0x0428, 0x0429, 0x042A, 0x042B, 0x042C, 0x042D, 0x042E, 0x042F,
    0x0430, 0x0431, 0x0432, 0x0433, 0x0434, 0x0435, 0x0436, 0x0437,
    0x0438, 0x0439, 0x043A, 0x043B, 0x043C, 0x043D, 0x043E, 0x043F,
    0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2556,
    0x2555, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
    0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
    0x255A, 0x2554, 0x2569, 0x2566, 0x2560, 0x2550, 0x256C, 0x2567,
    0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
    0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
    0x0440, 0x0441, 0x0442, 0x0443, 0x0444, 0x0445, 0x0446, 0x0447,
    0x0448, 0x0449, 0x044A, 0x044B, 0x044C, 0x044D, 0x044E, 0x044F,
    0x0401, 0x0451, 0x0404, 0x0454, 0x0407, 0x0457, 0x040E, 0x045E,
    0x00B0, 0x2219, 0x00B7, 0x221A, 0x2116, 0x00A4, 0x25A0, 0x00A0
];

const UNICODE_TO_CP866 = new Map();
for (let b = 0; b < 128; b++) UNICODE_TO_CP866.set(b, b);
for (let i = 0; i < CP866_MAP.length; i++) {
    UNICODE_TO_CP866.set(CP866_MAP[i], 128 + i);
}

const CP866_SAFE_REPLACEMENTS = {
    '«': '"', '»': '"', '“': '"', '”': '"', '„': '"', '‟': '"', '‘': "'", '’': "'",
    '—': '-', '–': '-', '−': '-', '№': 'N', '™': '(TM)', '©': '(C)', '®': '(R)',
    '€': 'EUR', '$': 'USD', '₽': 'руб.', '…': '...', '\u00a0': ' ', '\u200b': '',
    '\ufeff': '', '°': ' град.', '±': '+/-', 'µ': 'мк', 'μ': 'мк', 'Ø': 'диам.', '×': 'x'
};

export class DBFFieldDescriptor {
    constructor(name, type = 'C', length = 10, decimal = 0, offset = 0) {
        this.name = String(name || '').trim().toUpperCase().slice(0, 10);
        this.type = String(type || 'C').trim().toUpperCase().slice(0, 1);
        this.length = parseInt(length, 10) || 1;
        this.decimal = parseInt(decimal, 10) || 0;
        this.offset = parseInt(offset, 10) || 0;
    }

    toBytes() {
        const buffer = new ArrayBuffer(32);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        for (let i = 0; i < Math.min(this.name.length, 10); i++) {
            bytes[i] = this.name.charCodeAt(i) & 0x7F;
        }
        bytes[10] = 0x00;
        bytes[11] = this.type.charCodeAt(0);

        view.setUint32(12, this.offset, true);
        bytes[16] = Math.min(255, this.length);
        bytes[17] = Math.min(255, this.decimal);

        return bytes;
    }
}

export class WebDBFEngine {
    static LANG_DOS_CP866 = 0x26;
    static LANG_WIN_CP1251 = 0x25;
    static LANG_WIN_CP1251_ALT = 0xC8;

    static decodeCP866(uint8Array) {
        let res = '';
        for (let i = 0; i < uint8Array.length; i++) {
            const b = uint8Array[i];
            res += (b < 128) ? String.fromCharCode(b) : String.fromCharCode(CP866_MAP[b - 128] || 0x3F);
        }
        return res;
    }

    static encodeCP866(str) {
        if (!str) return new Uint8Array(0);
        let s = String(str);
        for (const [badCh, repl] of Object.entries(CP866_SAFE_REPLACEMENTS)) {
            s = s.replaceAll(badCh, repl);
        }
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) {
            const code = s.charCodeAt(i);
            const cpByte = UNICODE_TO_CP866.get(code);
            out[i] = (cpByte !== undefined) ? cpByte : 0x3F;
        }
        return out;
    }

    static readDBF(arrayBuffer, forcedEncoding = 'auto') {
        if (!arrayBuffer || arrayBuffer.byteLength < 32) {
            throw new Error("Файл поврежден: заголовок DBF меньше 32 байт.");
        }

        const view = new DataView(arrayBuffer);
        const bytes = new Uint8Array(arrayBuffer);

        const numRecords = view.getUint32(4, true);
        const headerLength = view.getUint16(8, true);
        const recordLength = view.getUint16(10, true);
        const languageByte = bytes[29];

        let activeEncoding = 'cp866';
        if (forcedEncoding !== 'auto') {
            activeEncoding = forcedEncoding.toLowerCase();
        } else if (languageByte === this.LANG_WIN_CP1251 || languageByte === this.LANG_WIN_CP1251_ALT) {
            activeEncoding = 'windows-1251';
        } else if (languageByte === this.LANG_DOS_CP866) {
            activeEncoding = 'cp866';
        } else {
            const sampleSlice = bytes.subarray(32, Math.min(bytes.length, 4096));
            let cyr1251 = 0, cyr866 = 0;
            for (let i = 0; i < sampleSlice.length; i++) {
                const b = sampleSlice[i];
                if ((b >= 192 && b <= 255) || b === 168 || b === 184) cyr1251++;
                if ((b >= 128 && b <= 175) || (b >= 224 && b <= 239) || b === 240 || b === 241) cyr866++;
            }
            activeEncoding = cyr1251 > cyr866 ? 'windows-1251' : 'cp866';
        }

        const isCp1251 = activeEncoding.includes('1251');
        const decoder1251 = isCp1251 && window.TextDecoder ? new TextDecoder('windows-1251') : null;

        const fields = [];
        let curOffset = 1;
        let pos = 32;

        while (pos < headerLength && pos + 32 <= bytes.length) {
            if (bytes[pos] === 0x0D) break;

            let fieldName = "";
            for (let i = 0; i < 10 && bytes[pos + i] !== 0; i++) {
                fieldName += String.fromCharCode(bytes[pos + i]);
            }

            const fType = String.fromCharCode(bytes[pos + 11]).toUpperCase();
            const fLen = bytes[pos + 16];
            const fDec = bytes[pos + 17];

            fields.push(new DBFFieldDescriptor(fieldName.trim(), fType, fLen, fDec, curOffset));
            curOffset += fLen;
            pos += 32;
        }

        const records = [];
        let recordPos = headerLength;

        for (let i = 0; i < numRecords; i++) {
            if (recordPos + recordLength > bytes.length) break;

            if (bytes[recordPos] === 0x2A) {
                recordPos += recordLength;
                continue;
            }

            const row = {};
            for (const field of fields) {
                const slice = bytes.subarray(recordPos + field.offset, recordPos + field.offset + field.length);
                const rawStr = (isCp1251 && decoder1251) ? decoder1251.decode(slice).trim() : this.decodeCP866(slice).trim();

                if (field.type === 'N' || field.type === 'F') {
                    const cleanNum = rawStr.replace(',', '.').replace(/\s/g, '').replace(/\xa0/g, '');
                    if (cleanNum && cleanNum !== '*' && cleanNum !== '?.??') {
                        row[field.name] = field.decimal > 0 ? parseFloat(cleanNum) || 0.0 : parseInt(cleanNum, 10) || 0;
                    } else {
                        row[field.name] = field.decimal > 0 ? 0.0 : 0;
                    }
                } else if (field.type === 'D') {
                    if (rawStr && rawStr.length === 8 && !rawStr.startsWith('1990') && !rawStr.startsWith('1900') && !rawStr.startsWith('0000')) {
                        row[field.name] = `${rawStr.slice(0, 4)}-${rawStr.slice(4, 6)}-${rawStr.slice(6, 8)}`;
                    } else {
                        row[field.name] = null;
                    }
                } else if (field.type === 'L') {
                    row[field.name] = ['T', 'Y', '1'].includes(rawStr.toUpperCase());
                } else {
                    row[field.name] = rawStr;
                }
            }

            records.push(row);
            recordPos += recordLength;
        }

        return { fields, records, languageByte, activeEncoding };
    }

    static writeDBF(fields, records, encoding = 'cp866') {
        const is866 = encoding.toLowerCase().includes('866');
        const langByte = is866 ? this.LANG_DOS_CP866 : this.LANG_WIN_CP1251;

        let curOffset = 1;
        fields.forEach(f => {
            f.offset = curOffset;
            curOffset += f.length;
        });

        const recordLen = curOffset;
        const headerLen = 32 + 32 * fields.length + 1;
        const totalFileLen = headerLen + records.length * recordLen + 1;

        const buffer = new ArrayBuffer(totalFileLen);
        const view = new DataView(buffer);
        const bytes = new Uint8Array(buffer);

        bytes[0] = 0x03;
        const now = new Date();
        bytes[1] = (now.getFullYear() - 1900) & 0xFF;
        bytes[2] = (now.getMonth() + 1) & 0xFF;
        bytes[3] = now.getDate() & 0xFF;

        view.setUint32(4, records.length, true);
        view.setUint16(8, headerLen, true);
        view.setUint16(10, recordLen, true);
        bytes[29] = langByte;

        let pos = 32;
        fields.forEach(f => {
            bytes.set(f.toBytes(), pos);
            pos += 32;
        });
        bytes[pos] = 0x0D;

        let recPos = headerLen;
        const asciiEncoder = new TextEncoder();

        records.forEach(rec => {
            bytes[recPos] = 0x20;

            fields.forEach(f => {
                const val = rec[f.name];
                const fieldSlice = bytes.subarray(recPos + f.offset, recPos + f.offset + f.length);
                fieldSlice.fill(0x20);

                if (f.type === 'C') {
                    const strVal = String(val !== null && val !== undefined ? val : '').trim();
                    const encoded = is866 ? this.encodeCP866(strVal) : asciiEncoder.encode(strVal);
                    fieldSlice.set(encoded.subarray(0, Math.min(encoded.length, f.length)));
                } else if (f.type === 'N' || f.type === 'F') {
                    if (val !== null && val !== undefined && String(val).trim() !== '') {
                        const numVal = parseFloat(val) || 0;
                        const strNum = f.decimal > 0 ? numVal.toFixed(f.decimal) : Math.round(numVal).toString();
                        const encoded = asciiEncoder.encode(strNum.padStart(f.length, ' '));
                        fieldSlice.set(encoded.subarray(0, Math.min(encoded.length, f.length)));
                    }
                } else if (f.type === 'D') {
                    if (val && String(val).trim() !== '' && !String(val).startsWith('1990') && !String(val).startsWith('1900')) {
                        const dateDigits = String(val).replace(/\D/g, '').slice(0, 8);
                        if (dateDigits.length === 8) {
                            fieldSlice.set(asciiEncoder.encode(dateDigits));
                        }
                    }
                } else if (f.type === 'L') {
                    bytes[recPos + f.offset] = val ? 0x54 : 0x46;
                }
            });

            recPos += recordLen;
        });

        bytes[recPos] = 0x1A;
        return buffer;
    }

    static downloadAsFile(arrayBuffer, filename = "document.dbf") {
        const blob = new Blob([arrayBuffer], { type: "application/x-dbf" });
        const link = document.createElement("a");
        const blobUrl = URL.createObjectURL(blob);
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    }
}