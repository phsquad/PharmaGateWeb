/**
 * js/ui/explorer_controller.js - Окно «Проводник» (File Explorer) для PharmaGateWeb VFS
 * 
 * Включает:
 * 1. 📂 Навигация по виртуальным папкам диска C:\ (Хлебные крошки, Вперед/Назад/Вверх)
 * 2. 🗂️ Режимы отображения: Крупная сетка (Grid) и Детальный список (List)
 * 3. 🖱️ Интеграция с рабочими модулями: двойной клик по .dbf/.xml/.xlsx сразу открывает накладную в Редакторе
 * 4. 📥 Drag & Drop прием файлов с реального ПК пользователя (Windows/macOS) в виртуальные папки
 * 5. 📤 Экспорт на физический диск и менеджмент (создание папок, переименование, удаление)
 * 
 * Developed by Alexander Talents Agency
 * Support: phsquad@internet.ru
 * © 2026 Alexander Talents Agency. All Rights Reserved.
 */

import { VirtualFS } from '../services/virtual_fs.js';

export class ExplorerController {
    constructor(app) {
        this.app = app;
        this.vfs = new VirtualFS();
        this.currentPath = "C:/Документы";
        this.history = ["C:/Документы"];
        this.historyIndex = 0;
        this.selectedPath = null;
        this.viewMode = 'grid'; // 'grid' | 'list'
        this.searchQuery = '';
    }

    async init() {
        await this.vfs.init();
        this._bindUI();
        await this.render();
    }

    _bindUI() {
        if (typeof document === 'undefined') return;

        // Навигация
        document.getElementById('btnExplorerBack')?.addEventListener('click', () => this.goBack());
        document.getElementById('btnExplorerForward')?.addEventListener('click', () => this.goForward());
        document.getElementById('btnExplorerUp')?.addEventListener('click', () => this.goUp());

        // Переключение вида
        document.getElementById('btnExplorerViewGrid')?.addEventListener('click', () => {
            this.viewMode = 'grid';
            this.render();
        });
        document.getElementById('btnExplorerViewList')?.addEventListener('click', () => {
            this.viewMode = 'list';
            this.render();
        });

        // Поиск
        const searchInput = document.getElementById('explorerSearchInput');
        searchInput?.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase().trim();
            this.renderItemsOnly();
        });

        // Панель действий
        document.getElementById('btnExplorerNewFolder')?.addEventListener('click', () => this.promptNewFolder());
        document.getElementById('btnExplorerNewFile')?.addEventListener('click', () => this.promptNewFile());
        document.getElementById('btnExplorerDelete')?.addEventListener('click', () => this.deleteSelected());
        document.getElementById('btnExplorerDownload')?.addEventListener('click', () => this.exportSelected());

        // Загрузка с ПК
        const fileInput = document.getElementById('explorerFileInput');
        document.getElementById('btnExplorerImport')?.addEventListener('click', () => fileInput?.click());
        fileInput?.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            for (const file of files) {
                await this.vfs.importRealFile(file, this.currentPath);
            }
            this.app._showToast?.(`📥 Импортировано файлов с ПК: ${files.length}`);
            this.render();
            fileInput.value = '';
        });

        // Боковая панель быстрого доступа
        document.querySelectorAll('.explorer-quick-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-path');
                if (target) this.navigateTo(target);
            });
        });

        // Drag & Drop реальных файлов с ПК в рабочую область проводника
        const dropZone = document.getElementById('explorerDropZone');
        if (dropZone) {
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('bg-blue-600/10', 'border-blue-500');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('bg-blue-600/10', 'border-blue-500');
            });
            dropZone.addEventListener('drop', async (e) => {
                e.preventDefault();
                dropZone.classList.remove('bg-blue-600/10', 'border-blue-500');

                const files = Array.from(e.dataTransfer.files || []);
                if (files.length > 0) {
                    for (const file of files) {
                        await this.vfs.importRealFile(file, this.currentPath);
                    }
                    this.app.crossPlatform?.playSound?.('click');
                    this.app._showToast?.(`📥 Перетащено с ПК в VFS: ${files.length} файл(ов)`);
                    this.render();
                }
            });
        }
    }

    async navigateTo(path) {
        const norm = this.vfs.normalizePath(path);
        if (norm === this.currentPath) return;

        this.currentPath = norm;
        this.selectedPath = null;
        this.searchQuery = '';
        const searchInput = document.getElementById('explorerSearchInput');
        if (searchInput) searchInput.value = '';

        // История переходов
        if (this.history[this.historyIndex] !== norm) {
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push(norm);
            this.historyIndex = this.history.length - 1;
        }

        this.app.crossPlatform?.playSound?.('click');
        await this.render();
    }

    async goBack() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.currentPath = this.history[this.historyIndex];
            this.selectedPath = null;
            await this.render();
        }
    }

    async goForward() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.currentPath = this.history[this.historyIndex];
            this.selectedPath = null;
            await this.render();
        }
    }

    async goUp() {
        const parent = this.vfs.getParentPath(this.currentPath);
        if (parent) {
            await this.navigateTo(parent);
        }
    }

    async promptNewFolder() {
        const name = prompt("Введите имя новой папки:", "Новая папка");
        if (!name || !name.trim()) return;

        const folderPath = `${this.currentPath}/${name.trim()}`;
        try {
            await this.vfs.mkdir(folderPath);
            this.app._showToast?.(`📁 Папка создана: ${name}`);
            await this.render();
        } catch (e) {
            alert("Ошибка создания папки: " + e.message);
        }
    }

    async promptNewFile() {
        const name = prompt("Введите имя нового документа:", "Документ.txt");
        if (!name || !name.trim()) return;

        const filePath = `${this.currentPath}/${name.trim()}`;
        try {
            await this.vfs.writeFile(filePath, "Создано в PharmaGateWeb VFS\nДата: " + new Date().toLocaleString(), "text/plain");
            this.app._showToast?.(`📝 Документ создан: ${name}`);
            await this.render();
        } catch (e) {
            alert("Ошибка создания файла: " + e.message);
        }
    }

    async deleteSelected() {
        if (!this.selectedPath) {
            alert("Выберите файл или папку для удаления.");
            return;
        }
        const name = this.vfs.getName(this.selectedPath);
        if (confirm(`Вы уверены, что хотите удалить «${name}»?`)) {
            try {
                await this.vfs.delete(this.selectedPath);
                this.selectedPath = null;
                this.app._showToast?.(`🗑️ Удалено: ${name}`);
                await this.render();
            } catch (e) {
                alert("Ошибка удаления: " + e.message);
            }
        }
    }

    async exportSelected() {
        if (!this.selectedPath) {
            alert("Выберите файл для скачивания на ПК.");
            return;
        }
        await this.vfs.exportFile(this.selectedPath);
        this.app._showToast?.(`📤 Файл выгружен на компьютер`);
    }

    async openItem(item) {
        if (item.type === 'folder') {
            await this.navigateTo(item.path);
            return;
        }

        // Если это накладная или табличные данные
        const ext = item.name.split('.').pop()?.toLowerCase();
        if (['dbf', 'xml', 'xlsx', 'csv'].includes(ext)) {
            const content = await this.vfs.readFile(item.path);
            const blob = (content instanceof Blob) ? content : new Blob([content]);
            const fileObj = new File([blob], item.name, { type: item.mime || '' });

            this.app.openApp('winEditor');
            await this.app.loadFile(fileObj);
            this.app._showToast?.(`📄 Накладная открыта в Редакторе: ${item.name}`);
            return;
        }

        // Если это файл базы данных SQLite
        if (['sqlite', 'db', 'sqlite3'].includes(ext)) {
            this.app.openApp('winSqlConsole');
            this.app._showToast?.(`🗄️ База данных открыта в SQL Консоли: ${item.name}`);
            return;
        }

        // Текстовые файлы и JSON: быстрый просмотр
        if (['txt', 'json', 'md', 'log'].includes(ext)) {
            const content = await this.vfs.readFile(item.path);
            let text = typeof content === 'string' ? content : new TextDecoder('utf-8').decode(content);
            alert(`--- [${item.name}] ---\n\n` + text.slice(0, 1000) + (text.length > 1000 ? "\n\n... (показаны первые 1000 символов)" : ""));
            return;
        }

        // Прочие файлы: предложение скачать
        await this.vfs.exportFile(item.path);
    }

    async render() {
        this.renderBreadcrumbs();
        this.updateNavButtons();
        await this.renderItemsOnly();
    }

    renderBreadcrumbs() {
        const container = document.getElementById('explorerBreadcrumbs');
        if (!container) return;

        const parts = this.currentPath.split('/').filter(Boolean);
        let accumulated = '';

        container.innerHTML = parts.map((part, idx) => {
            accumulated += (idx === 0 ? part : '/' + part);
            const isLast = idx === parts.length - 1;
            const targetPath = accumulated;

            return `
                <button class="px-1.5 py-0.5 rounded hover:bg-white/10 text-xs font-mono font-medium ${isLast ? 'text-white font-bold' : 'text-slate-400'} cursor-pointer"
                        onclick="window.PharmaGate?.explorer?.navigateTo('${targetPath}')">
                    ${idx === 0 ? '💻 ' + part : part}
                </button>
                ${!isLast ? '<span class="text-slate-600 font-mono text-xs select-none">/</span>' : ''}
            `;
        }).join('');
    }

    updateNavButtons() {
        const btnBack = document.getElementById('btnExplorerBack');
        const btnFwd = document.getElementById('btnExplorerForward');
        const btnUp = document.getElementById('btnExplorerUp');

        if (btnBack) btnBack.disabled = this.historyIndex <= 0;
        if (btnFwd) btnFwd.disabled = this.historyIndex >= this.history.length - 1;
        if (btnUp) btnUp.disabled = this.currentPath === "C:";

        [btnBack, btnFwd, btnUp].forEach(btn => {
            if (btn) {
                btn.classList.toggle('opacity-40', btn.disabled);
                btn.classList.toggle('cursor-not-allowed', btn.disabled);
            }
        });
    }

    async renderItemsOnly() {
        const container = document.getElementById('explorerItemsContainer');
        const statusCount = document.getElementById('explorerStatusCount');
        const statusSize = document.getElementById('explorerStatusSize');
        if (!container) return;

        let items = await this.vfs.readdir(this.currentPath);

        if (this.searchQuery) {
            items = items.filter(it => it.name.toLowerCase().includes(this.searchQuery));
        }

        // Статистика
        let totalSize = 0;
        items.forEach(it => totalSize += (it.size || 0));
        if (statusCount) statusCount.textContent = `${items.length} элемент(ов)`;
        if (statusSize) statusSize.textContent = totalSize > 1024 * 1024 ? `${(totalSize / (1024 * 1024)).toFixed(2)} МБ` : `${(totalSize / 1024).toFixed(1)} КБ`;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-16 flex flex-col items-center justify-center text-slate-500 space-y-2 select-none">
                    <span class="text-4xl">📂</span>
                    <span class="text-xs">Папка пуста</span>
                    <span class="text-[11px] text-slate-600">Перетащите сюда файлы с рабочего стола ПК или нажмите «Импорт»</span>
                </div>
            `;
            return;
        }

        if (this.viewMode === 'grid') {
            container.className = "grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4";
            container.innerHTML = items.map(item => {
                const isSelected = item.path === this.selectedPath;
                const icon = this._getItemIcon(item);

                return `
                    <div class="explorer-item group relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all cursor-pointer select-none text-center ${isSelected ? 'bg-blue-600/30 border-blue-500/80 shadow-md shadow-blue-500/20' : 'bg-slate-900/60 border-white/5 hover:bg-white/10 hover:border-white/15'}"
                         onclick="window.PharmaGate?.explorer?.selectItem('${item.path}')"
                         ondblclick="window.PharmaGate?.explorer?.openItemByPath('${item.path}')">
                        <span class="text-3xl filter drop-shadow leading-none">${icon}</span>
                        <span class="text-xs font-semibold text-slate-200 group-hover:text-white truncate max-w-full leading-tight" title="${item.name}">${item.name}</span>
                        <span class="text-[10px] text-slate-500 font-mono">${item.type === 'folder' ? 'Папка' : this._formatSize(item.size)}</span>
                    </div>
                `;
            }).join('');
        } else {
            // Список таблицей
            container.className = "flex flex-col p-2 space-y-1";
            container.innerHTML = `
                <div class="flex items-center justify-between px-3 py-1.5 text-[10px] uppercase font-bold text-slate-500 border-b border-white/10 select-none">
                    <span class="flex-1">Имя</span>
                    <span class="w-28 text-right">Дата изменения</span>
                    <span class="w-20 text-right">Размер</span>
                </div>
            ` + items.map(item => {
                const isSelected = item.path === this.selectedPath;
                const icon = this._getItemIcon(item);
                const dateStr = new Date(item.updatedAt || Date.now()).toLocaleDateString('ru-RU');

                return `
                    <div class="explorer-item flex items-center justify-between px-3 py-2 rounded-lg border transition-all cursor-pointer select-none text-xs ${isSelected ? 'bg-blue-600/30 border-blue-500/80 shadow-sm' : 'border-transparent hover:bg-white/5 hover:border-white/10'}"
                         onclick="window.PharmaGate?.explorer?.selectItem('${item.path}')"
                         ondblclick="window.PharmaGate?.explorer?.openItemByPath('${item.path}')">
                        <div class="flex items-center gap-2.5 flex-1 min-w-0 mr-4">
                            <span class="text-base shrink-0">${icon}</span>
                            <span class="font-semibold text-slate-200 truncate" title="${item.name}">${item.name}</span>
                        </div>
                        <span class="w-28 text-right text-[11px] text-slate-400 font-mono">${dateStr}</span>
                        <span class="w-20 text-right text-[11px] text-slate-400 font-mono">${item.type === 'folder' ? '—' : this._formatSize(item.size)}</span>
                    </div>
                `;
            }).join('');
        }
    }

    selectItem(path) {
        this.selectedPath = path;
        this.renderItemsOnly();
    }

    async openItemByPath(path) {
        const item = await this.vfs.stat(path);
        if (item) this.openItem(item);
    }

    _getItemIcon(item) {
        if (item.type === 'folder') return '📁';
        const ext = item.name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'dbf': return '📊';
            case 'xml': return '📑';
            case 'xlsx': case 'xls': return '📗';
            case 'csv': return '📄';
            case 'sqlite': case 'db': return '🗄️';
            case 'json': return '⚙️';
            case 'txt': case 'md': return '📝';
            case 'zip': return '📦';
            default: return '📄';
        }
    }

    _formatSize(bytes) {
        if (!bytes || bytes === 0) return "0 Б";
        if (bytes < 1024) return bytes + " Б";
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " КБ";
        return (bytes / (1024 * 1024)).toFixed(2) + " МБ";
    }
}
