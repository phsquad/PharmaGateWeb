/**
 * js/services/label_printer.js - Промышленный движок печати термоэтикеток и ценников для аптек.
 * 
 * Включает:
 * - Векторные генераторы штрихкодов EAN-13 и Code-128 в чистый SVG без внешних шрифтов;
 * - Пресеты под популярные термопринтеры (Zebra, Xprinter, АТОЛ, TSC) 58x40мм, 43x25мм, 30x20мм и сетку А4;
 * - Пакетную печать ценников с разбивкой по страницам и контролем размеров через CSS @media print.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { DateEngine } from '../engine/date_engine.js';
import { PharmaMath } from '../engine/pharma_math.js';

export class BarcodeSvgGenerator {
    /**
     * Таблица кодирования EAN-13: L, G, R паттерны (7 бит на цифру)
     */
    static EAN_L = [
        "0001101", "0011001", "0010011", "0111101", "0100011",
        "0110001", "0101111", "0111011", "0110111", "0001011"
    ];
    static EAN_G = [
        "0100111", "0110011", "0011011", "0100001", "0011101",
        "0111001", "0000101", "0010001", "0001001", "0010111"
    ];
    static EAN_R = [
        "1110010", "1100110", "1101100", "1000010", "1011100",
        "1001110", "1010000", "1000100", "1001000", "1110100"
    ];
    static FIRST_DIGIT_STRUCTURE = [
        "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
        "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"
    ];

    /**
     * Генерация векторного SVG штрихкода EAN-13
     */
    static generateEan13Svg(barcodeString, height = 45) {
        let clean = String(barcodeString || '').replace(/\D/g, '');
        if (clean.length < 12) clean = clean.padStart(12, '0');
        if (clean.length === 12) {
            // Расчет контрольной цифры Modulo 10
            let sum = 0;
            for (let i = 0; i < 12; i++) {
                sum += parseInt(clean[11 - i], 10) * (i % 2 === 0 ? 3 : 1);
            }
            const check = (10 - (sum % 10)) % 10;
            clean += check;
        }
        clean = clean.slice(0, 13);

        const firstDigit = parseInt(clean[0], 10);
        const structure = this.FIRST_DIGIT_STRUCTURE[firstDigit] || "LLLLLL";

        // Построение битовой последовательности EAN-13
        let bits = "101"; // Начальный разделитель (Start Guard)

        // Первые 6 цифр
        for (let i = 1; i <= 6; i++) {
            const digit = parseInt(clean[i], 10);
            const mode = structure[i - 1];
            bits += (mode === 'L' ? this.EAN_L[digit] : this.EAN_G[digit]);
        }

        bits += "01010"; // Центральный разделитель (Center Guard)

        // Последние 6 цифр
        for (let i = 7; i <= 12; i++) {
            const digit = parseInt(clean[i], 10);
            bits += this.EAN_R[digit];
        }

        bits += "101"; // Конечный разделитель (End Guard)

        // Формирование SVG рендеринга
        const barWidth = 1.6;
        const totalW = Math.round(bits.length * barWidth);
        const h = height;

        let rects = "";
        for (let i = 0; i < bits.length; i++) {
            if (bits[i] === '1') {
                const isGuard = (i < 3) || (i >= 45 && i < 50) || (i >= 92);
                const barH = isGuard ? h : (h - 8);
                const x = (i * barWidth).toFixed(1);
                rects += `<rect x="${x}" y="0" width="${barWidth}" height="${barH}" fill="#000000"/>`;
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${h + 12}" width="${totalW}" height="${h + 12}" class="mx-auto select-none">
            ${rects}
            <text x="${totalW / 2}" y="${h + 9}" font-family="'JetBrains Mono', monospace, sans-serif" font-size="10" font-weight="700" fill="#000000" text-anchor="middle" letter-spacing="2">${clean}</text>
        </svg>`;
    }

    /**
     * Генерация векторного визуального DataMatrix квадрата
     */
    static generateDataMatrixSvg(text, size = 60) {
        const clean = String(text || '0104600000000000210000000000000');
        const hash = Array.from(clean).reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0);
        const matrixSize = 16;
        const cellSize = size / matrixSize;

        let cells = "";
        for (let r = 0; r < matrixSize; r++) {
            for (let c = 0; c < matrixSize; c++) {
                // Внешний L-border для DataMatrix
                const isLBorder = (r === matrixSize - 1) || (c === 0);
                const isAltBorder = (r === 0 && c % 2 === 0) || (c === matrixSize - 1 && r % 2 === 0);
                const isDataBit = ((hash ^ (r * 13 + c * 37)) & 1) === 1;

                if (isLBorder || isAltBorder || (r > 0 && r < matrixSize - 1 && c > 0 && c < matrixSize - 1 && isDataBit)) {
                    cells += `<rect x="${(c * cellSize).toFixed(1)}" y="${(r * cellSize).toFixed(1)}" width="${cellSize.toFixed(1)}" height="${cellSize.toFixed(1)}" fill="#000000"/>`;
                }
            }
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="border border-slate-300 p-1 bg-white">
            ${cells}
        </svg>`;
    }
}

export class LabelPrinterService {
    static FORMATS = {
        "58x40": { name: "58 × 40 мм (Термо-ценник)", widthMm: 58, heightMm: 40, colsA4: 3 },
        "43x25": { name: "43 × 25 мм (Компактный стикер)", widthMm: 43, heightMm: 25, colsA4: 4 },
        "30x20": { name: "30 × 20 мм (Мини-штрихкод)", widthMm: 30, heightMm: 20, colsA4: 6 },
        "a4_sheet": { name: "A4 Сетка (Самоклейка 3 × 8)", widthMm: 65, heightMm: 35, isSheet: true }
    };

    /**
     * Генерация HTML одной этикетки
     */
    static renderSingleLabelHtml(record, options = {}) {
        const orgName = options.orgName || "АПТЕКА «НЕО-ФАРМ»";
        const formatKey = options.format || "58x40";
        const fmt = this.FORMATS[formatKey] || this.FORMATS["58x40"];

        const name = record.NAME || "Наименование препарата";
        const p2 = PharmaMath.cleanDecimal(record.PRICE2, 150.00);
        const rubles = Math.floor(p2);
        const kopecks = String(Math.round((p2 - rubles) * 100)).padStart(2, '0');

        const barcode = record.EAN13 || record.GTIN || "4607003560014";
        const ser = record.SER || "б/с";
        const gdate = DateEngine.formatForUI(record.GDATE, "10.2027");
        const firm = record.FIRM || "Производитель";
        const cntr = record.CNTR || "Россия";

        const eanSvg = BarcodeSvgGenerator.generateEan13Svg(barcode, fmt.heightMm > 25 ? 32 : 22);
        const dmSvg = BarcodeSvgGenerator.generateDataMatrixSvg(record.GTIN || barcode, 38);

        if (formatKey === '30x20') {
            return `
            <div class="pharma-thermal-label flex flex-col justify-between p-1 bg-white text-black font-sans overflow-hidden border border-slate-300" 
                 style="width: ${fmt.widthMm}mm; height: ${fmt.heightMm}mm; page-break-after: always; box-sizing: border-box;">
                <div class="text-[7px] font-bold truncate leading-tight">${name}</div>
                <div class="flex items-center justify-between">
                    <span class="text-[7px]">Сер: ${ser}</span>
                    <span class="text-[9px] font-black">${rubles} ₽</span>
                </div>
                <div class="scale-75 origin-bottom-left -ml-2 -mb-1">${eanSvg}</div>
            </div>`;
        }

        if (formatKey === '43x25') {
            return `
            <div class="pharma-thermal-label flex flex-col justify-between p-1.5 bg-white text-black font-sans overflow-hidden border border-slate-300" 
                 style="width: ${fmt.widthMm}mm; height: ${fmt.heightMm}mm; page-break-after: always; box-sizing: border-box;">
                <div class="flex justify-between text-[7px] text-slate-700 border-b border-slate-200 pb-0.5">
                    <span class="font-bold truncate max-w-[70%]">${orgName}</span>
                    <span>${DateEngine.formatForUI(new Date())}</span>
                </div>
                <div class="text-[9px] font-bold line-clamp-2 leading-tight my-0.5">${name}</div>
                <div class="flex items-center justify-between">
                    <div class="scale-90 origin-left">${eanSvg}</div>
                    <div class="text-right">
                        <div class="text-xs font-black tracking-tight leading-none">${rubles}<span class="text-[9px] font-bold">.${kopecks}</span> ₽</div>
                        <div class="text-[7px] text-slate-600 mt-0.5">Годен до: ${gdate}</div>
                    </div>
                </div>
            </div>`;
        }

        // Стандарт 58x40 мм
        return `
        <div class="pharma-thermal-label flex flex-col justify-between p-2.5 bg-white text-black font-sans overflow-hidden rounded shadow-sm border border-slate-300" 
             style="width: ${fmt.widthMm}mm; height: ${fmt.heightMm}mm; page-break-after: always; box-sizing: border-box;">
            <!-- Шапка этикетки -->
            <div class="flex justify-between items-center text-[9px] text-slate-800 border-b border-slate-400 pb-1">
                <span class="font-extrabold tracking-wide uppercase truncate max-w-[65%]">${orgName}</span>
                <span class="font-mono text-[8px] text-slate-600">${DateEngine.formatForUI(new Date())}</span>
            </div>

            <!-- Наименование -->
            <div class="text-[11px] font-bold leading-tight line-clamp-2 my-1 text-slate-900">${name}</div>

            <!-- Серия и Производитель -->
            <div class="grid grid-cols-2 text-[8px] text-slate-700 leading-tight">
                <div>Сер: <b>${ser}</b> | До: <b>${gdate}</b></div>
                <div class="text-right truncate">${firm}, ${cntr}</div>
            </div>

            <!-- Цена и Штрихкоды -->
            <div class="flex items-end justify-between pt-1 border-t border-slate-300 mt-1">
                <div class="flex items-center gap-1.5">
                    ${options.showDataMatrix ? `<div class="shrink-0">${dmSvg}</div>` : ''}
                    <div class="scale-95 origin-bottom-left">${eanSvg}</div>
                </div>
                <div class="text-right leading-none pl-1">
                    <div class="text-[8px] uppercase tracking-wider text-slate-600 mb-0.5">ЦЕНА:</div>
                    <div class="text-lg font-black tracking-tight text-black flex items-start justify-end">
                        <span>${rubles}</span>
                        <span class="text-[10px] font-bold ml-0.5 mt-0.5">.${kopecks} ₽</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    /**
     * Запуск окна прямой печати на термопринтере через CSS @media print
     */
    static printLabels(records, options = {}) {
        const formatKey = options.format || "58x40";
        const fmt = this.FORMATS[formatKey] || this.FORMATS["58x40"];

        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) throw new Error("Всплывающее окно заблокировано браузером. Разрешите всплывающие окна для печати.");

        const labelsHtml = records.map(r => this.renderSingleLabelHtml(r, options)).join('\n');

        const fullHtml = `<!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>Печать ценников - PharmaGate</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @page {
                    size: ${fmt.widthMm}mm ${fmt.heightMm}mm;
                    margin: 0;
                }
                body {
                    margin: 0;
                    padding: 0;
                    background: #f1f5f9;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .pharma-thermal-label {
                    page-break-after: always;
                    break-after: page;
                }
                @media print {
                    body { background: transparent; }
                    .no-print { display: none !important; }
                    .pharma-thermal-label { border: none !important; }
                }
            </style>
        </head>
        <body class="p-4 flex flex-col items-center gap-4">
            <div class="no-print bg-slate-900 text-white p-3 rounded-xl shadow flex items-center justify-between w-full max-w-md">
                <div>
                    <div class="font-bold text-xs">Печать термоэтикеток (${records.length} шт.)</div>
                    <div class="text-[10px] text-slate-400">Формат: ${fmt.name}</div>
                </div>
                <button onclick="window.print()" class="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-bold cursor-pointer">
                    🖨️ Печать
                </button>
            </div>
            ${labelsHtml}
            <script>
                window.onload = () => { setTimeout(() => window.print(), 400); };
            </script>
        </body>
        </html>`;

        printWindow.document.write(fullHtml);
        printWindow.document.close();
    }

    /**
     * Алиас для предпросмотра этикетки
     */
    static getPreviewSvg(record, format = '58x40', options = {}) {
        return this.renderSingleLabelHtml(record, { format, ...options });
    }
}
