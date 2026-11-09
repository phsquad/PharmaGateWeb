const fs = require('fs');
const path = require('path');

function walk(dir) {
    const results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        if (file === '.git' || file === 'node_modules' || file === 'vendor') return;
        const full = path.join(dir, file);
        const stat = fs.statSync(full);
        if (stat && stat.isDirectory()) {
            results.push(...walk(full));
        } else if (file.endsWith('.js')) {
            results.push(full);
        }
    });
    return results;
}

const jsFiles = walk('./js');
console.log(`Auditing imports and exports across ${jsFiles.length} JavaScript files...\n`);

function getExports(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const exports = new Set();
    let hasDefault = false;

    // export class Foo / export function Foo / export const Foo / export let Foo
    const declMatches = content.matchAll(/export\s+(?:async\s+)?(?:class|function|const|let|var)\s+([a-zA-Z0-9_$]+)/g);
    for (const m of declMatches) {
        exports.add(m[1]);
    }

    // export { Foo, Bar as Baz }
    const listMatches = content.matchAll(/export\s*\{([^}]+)\}/g);
    for (const m of listMatches) {
        const items = m[1].split(',');
        items.forEach(item => {
            const parts = item.trim().split(/\s+as\s+/);
            const exportedName = (parts[1] || parts[0]).trim();
            if (exportedName === 'default') {
                hasDefault = true;
            } else if (exportedName) {
                exports.add(exportedName);
            }
        });
    }

    // export default
    if (/export\s+default\s+/g.test(content)) {
        hasDefault = true;
    }

    return { exports, hasDefault, rawContent: content };
}

let totalErrors = 0;

jsFiles.forEach(srcFile => {
    const content = fs.readFileSync(srcFile, 'utf8');
    const importRegex = /import\s+(?:([\w$]+)\s*,?\s*)?(?:\{([^}]+)\})?(?:\*\s+as\s+([\w$]+))?\s+from\s+['"]([^'"]+)['"]/g;
    
    let match;
    while ((match = importRegex.exec(content)) !== null) {
        const [full, defaultImport, namedImports, namespaceImport, importPathRaw] = match;
        
        // Strip query params like ?v=...
        const importPath = importPathRaw.split('?')[0];

        // Only inspect local imports (starting with ./ or ../)
        if (!importPath.startsWith('.')) continue;

        const resolvedTarget = path.normalize(path.join(path.dirname(srcFile), importPath));

        if (!fs.existsSync(resolvedTarget)) {
            console.error(`❌ [FILE NOT FOUND] In ${srcFile}: cannot resolve '${importPathRaw}' -> '${resolvedTarget}'`);
            totalErrors++;
            continue;
        }

        const targetExports = getExports(resolvedTarget);

        // Check default import
        if (defaultImport && !targetExports.hasDefault) {
            console.error(`❌ [DEFAULT EXPORT MISSING] In ${srcFile}: imports default '${defaultImport}', but ${resolvedTarget} has no default export!`);
            totalErrors++;
        }

        // Check named imports
        if (namedImports) {
            const names = namedImports.split(',').map(n => n.trim()).filter(Boolean);
            names.forEach(n => {
                const parts = n.split(/\s+as\s+/);
                const originalName = parts[0].trim();
                if (!targetExports.exports.has(originalName)) {
                    // Check if there is a case mismatch
                    const allExp = Array.from(targetExports.exports);
                    const caseMatch = allExp.find(e => e.toLowerCase() === originalName.toLowerCase());
                    if (caseMatch) {
                        console.error(`❌ [CASE MISMATCH] In ${srcFile}: imports '${originalName}', but ${resolvedTarget} exports '${caseMatch}'!`);
                    } else {
                        console.error(`❌ [NAMED EXPORT MISSING] In ${srcFile}: imports '${originalName}', but ${resolvedTarget} does NOT export it! Available: [${allExp.join(', ')}]`);
                    }
                    totalErrors++;
                }
            });
        }
    }
});

console.log(`\n========================================`);
if (totalErrors === 0) {
    console.log(`✔ SUCCESS: All imports and exports match 100% across all JS files!`);
} else {
    console.log(`❌ FAILED: Found ${totalErrors} import/export discrepancies.`);
}
console.log(`========================================`);
