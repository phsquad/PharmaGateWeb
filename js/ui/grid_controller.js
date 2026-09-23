/**
 * js/ui/grid_controller.js - Виртуальный табличный контроллер Tabulator.js со стилизацией ФЛК.
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { PharmaMath } from '../engine/pharma_math.js';
import { DateEngine } from '../engine/date_engine.js';
import { EncodingGuard } from '../engine/text_engine.js';

export class GridController {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;
        this.tabulator = null;
        this.schema = null;
        this.records = [];
        this.issuesMap = new Map();
        
        this.onDataChanged = options.onDataChanged || (() => {});
        this.onSelectionChanged = options.onSelectionChanged || (() => {});
    }

    initGrid(schema, records = [], issues = []) {
        this.schema = schema;
        this.records = records;
        this._buildIssuesMap(issues);

        if (!this.container) return;

        if (this.tabulator) {
            this.tabulator.destroy();
            this.tabulator = null;
        }

        const columns = this._createColumnDefinitions(schema);

        this.tabulator = new window.Tabulator(this.container, {
            data: this.records,
            layout: "fitDataFill",
            virtualDom: true,
            virtualDomBuffer: 300,
            height: "100%",
            selectable: true,
            columns: columns,
            placeholder: "<div class='text-slate-400 py-12 text-center text-sm font-semibold'>Накладная пуста. Откройте файл (Ctrl+O) или создайте документ (Ctrl+N).</div>",
            cellEdited: (cell) => this._handleCellEdit(cell),
            rowSelectionChanged: () => {
                const selectedRows = this.tabulator ? this.tabulator.getSelectedData() : [];
                this.onSelectionChanged(selectedRows);
            }
        });
    }

    _buildIssuesMap(issues = []) {
        this.issuesMap.clear();
        const severityWeights = { 'CRITICAL': 3, 'WARNING': 2, 'INFO': 1 };

        issues.forEach(issue => {
            if (issue.rowIndex !== null && issue.rowIndex !== undefined && issue.rowIndex >= 1) {
                const fieldName = String(issue.field || '').trim().toUpperCase();
                const key = `${issue.rowIndex}_${fieldName}`;

                if (this.issuesMap.has(key)) {
                    const existing = this.issuesMap.get(key);
                    if ((severityWeights[issue.severity] || 0) > (severityWeights[existing.severity] || 0)) {
                        this.issuesMap.set(key, issue);
                    }
                } else {
                    this.issuesMap.set(key, issue);
                }
            }
        });
    }

    _createColumnDefinitions(schema) {
        const columns = [
            {
                title: "#",
                formatter: "rownum",
                hozAlign: "center",
                width: 45,
                headerSort: false,
                frozen: true,
                resizable: false
            }
        ];

        schema.fields.forEach(f => {
            const fieldKey = f.name.toUpperCase();
            const isNumeric = ['N', 'F'].includes(f.type);
            const isDate = f.type === 'D';
            const isLogical = f.type === 'L';

            let colWidth = 120;
            if (['NAME', 'FIRM', 'SERTIF'].includes(fieldKey)) colWidth = 240;
            else if (['CODEPST', 'EAN13', 'GTIN', 'SER', 'SUBJID'].includes(fieldKey)) colWidth = 140;
            else if (['QNT', 'PRICE1', 'PRICE2', 'PRICE2N', 'SUMSTR', 'SUMSNDS', 'REGPRC', 'NDS'].includes(fieldKey)) colWidth = 110;
            else if (['DATEDOC', 'GDATE', 'DATEMADE', 'BILLDT', 'DATEZ', 'SERTDATE', 'PAYDATE'].includes(fieldKey)) colWidth = 105;

            let align = "left";
            if (isNumeric) align = "right";
            else if (isDate || isLogical || ['CODEPST', 'EAN13', 'GTIN', 'SER', 'NDOC', 'BILLNUM', 'NUMZ', 'PODRCD', 'NUMGTD'].includes(fieldKey)) align = "center";

            columns.push({
                title: f.userName || f.name,
                field: fieldKey,
                editor: "input",
                width: colWidth,
                hozAlign: align,
                headerSort: true,
                formatter: (cell) => {
                    const rowIdx = cell.getRow().getPosition();
                    const val = cell.getValue();
                    const el = cell.getElement();
                    const issueKey = `${rowIdx}_${fieldKey}`;
                    const issue = this.issuesMap.get(issueKey);

                    el.classList.remove('flk-critical', 'flk-warning', 'flk-info');

                    if (issue) {
                        if (issue.severity === 'CRITICAL') el.classList.add('flk-critical');
                        else if (issue.severity === 'WARNING') el.classList.add('flk-warning');
                        else el.classList.add('flk-info');
                        el.title = `[${issue.severity}] ${issue.userText}`;
                    } else {
                        el.title = `${f.userName || f.name} (${fieldKey})`;
                    }

                    if (isDate) {
                        return DateEngine.formatForUI(val);
                    }

                    if (isNumeric) {
                        if (val !== null && val !== undefined && String(val).trim() !== '') {
                            const num = parseFloat(val);
                            if (isNaN(num)) return '';
                            return f.decimal > 0 ? num.toFixed(f.decimal) : String(Math.round(num));
                        }
                        return '';
                    }

                    if (isLogical) {
                        return val ? 'Да' : 'Нет';
                    }

                    return val !== null && val !== undefined ? String(val) : '';
                }
            });
        });

        return columns;
    }

    _handleCellEdit(cell) {
        const fieldName = cell.getField().toUpperCase();
        const row = cell.getRow();
        const rowData = row.getData();
        let rawVal = cell.getValue();

        const fieldRule = this.schema ? this.schema.fields.find(f => f.name.toUpperCase() === fieldName) : null;

        if (fieldRule) {
            if (['N', 'F'].includes(fieldRule.type)) {
                rowData[fieldName] = PharmaMath.cleanDecimal(rawVal, 0.0);
            } else if (fieldRule.type === 'D') {
                rowData[fieldName] = DateEngine.parseAnyDate(rawVal);
            } else if (fieldRule.type === 'C') {
                if (['CODEPST', 'EAN13', 'GTIN', 'SER', 'NDOC', 'PODRCD'].includes(fieldName)) {
                    rowData[fieldName] = EncodingGuard.sanitizeCodepstProtek(String(rawVal || ''));
                } else {
                    rowData[fieldName] = EncodingGuard.sanitizeText366(String(rawVal || ''));
                }
            }
        }

        // Реактивный перерасчет сумм
        if (['QNT', 'PRICE2', 'PRICE2N', 'NDS'].includes(fieldName)) {
            const qnt = PharmaMath.cleanDecimal(rowData.QNT, 1.0);
            let p2 = PharmaMath.cleanDecimal(rowData.PRICE2, 0.0);
            let p2n = PharmaMath.cleanDecimal(rowData.PRICE2N, 0.0);
            const ndsRaw = rowData.NDS;

            let nds = 10;
            if ((p2 > 0 && Math.abs(p2 - p2n) < 0.01) || String(ndsRaw) === '0') {
                nds = 0;
            } else if (ndsRaw !== undefined && ndsRaw !== null && String(ndsRaw).trim() !== '') {
                nds = parseInt(ndsRaw, 10) || 10;
            }

            if (fieldName === 'PRICE2N' && p2n > 0) {
                const ndsRate = 1.0 + (nds / 100.0);
                p2 = PharmaMath.roundMoney(p2n * ndsRate);
                rowData.PRICE2 = p2;
            }

            if (p2 > 0) {
                const fin = PharmaMath.calculateLine(qnt, p2, nds);
                rowData.PRICE2N = fin.price2n;
                rowData.SUMSTR = fin.sumstr;
                rowData.SUMSNDS = fin.sumsnds;
                rowData.NDS = nds;
            }
        }

        row.update(rowData);
        this.records = this.tabulator.getData();
        this.onDataChanged(this.records);
    }

    updateData(records, schema = null, issues = null) {
        if (schema) this.schema = schema;
        this.records = records || [];
        if (issues) this._buildIssuesMap(issues);

        if (this.tabulator) {
            this.tabulator.setData(this.records).then(() => {
                this.tabulator.redraw(true);
            });
        } else if (this.schema) {
            this.initGrid(this.schema, this.records, issues || []);
        }
    }

    updateIssues(issues = []) {
        this._buildIssuesMap(issues);
        if (this.tabulator) {
            this.tabulator.redraw(true);
        }
    }

    applyVatToSelection(vatPercent) {
        if (!this.tabulator) return;
        const selectedRows = this.tabulator.getSelectedRows();
        if (selectedRows.length === 0) return;

        selectedRows.forEach(row => {
            const d = { ...row.getData() };
            d.NDS = vatPercent;

            const qnt = PharmaMath.cleanDecimal(d.QNT, 1.0);
            const p2 = PharmaMath.cleanDecimal(d.PRICE2, 0.0);

            if (p2 > 0) {
                const fin = PharmaMath.calculateLine(qnt, p2, vatPercent);
                d.PRICE2N = fin.price2n;
                d.SUMSTR = fin.sumstr;
                d.SUMSNDS = fin.sumsnds;
            }

            row.update(d);
        });

        this.records = this.tabulator.getData();
        this.onDataChanged(this.records);
    }

    async copySelectionToClipboard() {
        if (!this.tabulator || !this.schema) return false;

        const selectedData = this.tabulator.getSelectedData();
        const dataToExport = selectedData.length > 0 ? selectedData : this.tabulator.getData();

        if (dataToExport.length === 0) return false;

        const headers = this.schema.fields.map(f => f.userName || f.name);
        const fields = this.schema.fields.map(f => f.name.toUpperCase());

        const lines = [headers.join('\t')];

        dataToExport.forEach(row => {
            const rowVals = fields.map(fieldKey => {
                const val = row[fieldKey];
                return val !== null && val !== undefined ? String(val).replace(/\t|\r?\n/g, ' ') : '';
            });
            lines.push(rowVals.join('\t'));
        });

        const tsvText = lines.join('\n');

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(tsvText);
                return true;
            }
        } catch (e) {
            console.warn(e);
        }

        const textArea = document.createElement("textarea");
        textArea.value = tsvText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
    }

    searchAndSelect(query) {
        if (!this.tabulator || !query) return false;
        const cleanQuery = String(query).trim().toLowerCase();
        if (!cleanQuery) return false;

        const rows = this.tabulator.getRows();
        for (const row of rows) {
            const d = row.getData();
            const searchBlob = `${d.CODEPST || ''} ${d.NAME || ''} ${d.SER || ''} ${d.EAN13 || ''}`.toLowerCase();
            if (searchBlob.includes(cleanQuery)) {
                this.tabulator.deselectRow();
                row.select();
                this.tabulator.scrollToRow(row, "center", true);
                return true;
            }
        }
        return false;
    }
}