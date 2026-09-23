/**
 * js/engine/pipeline_sanitizers.js - Пакетная очистка строк и детектор призраков Excel.
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { EncodingGuard } from './text_engine.js';
import { DateEngine } from './date_engine.js';
import { PharmaMath } from './pharma_math.js';

export class PipelineSanitizers {
    static isGhostRow(row) {
        if (!row || typeof row !== 'object') return true;

        for (const [k, v] of Object.entries(row)) {
            if (!k) continue;
            const kUpper = k.toUpperCase();
            if (['NAME', 'НАИМЕНОВАНИЕ', 'ТОВАР', 'CODE', 'КОД', 'АРТИКУЛ', 'EAN', 'ШТРИХ'].some(m => kUpper.includes(m))) {
                const valStr = String(v !== null && v !== undefined ? v : '').trim().replace(/[\xa0\u200b]/g, '');
                if (valStr) return false;
            }
        }
        return true;
    }

    static sanitizeRow(row) {
        const cleaned = {};
        for (const [k, v] of Object.entries(row)) {
            if (!k) continue;
            const cleanKey = k.trim().toUpperCase().replace(/[\s.-]/g, '_');
            cleaned[cleanKey] = v;
        }
        return cleaned;
    }

    static cleanBatch(records) {
        const cleaned = [];
        let ghostsCount = 0;

        for (const r of records) {
            if (this.isGhostRow(r)) {
                ghostsCount++;
                continue;
            }
            cleaned.push(this.sanitizeRow(r));
        }
        return { records: cleaned, ghostsCount };
    }
}