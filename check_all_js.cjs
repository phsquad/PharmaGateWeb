const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function getJsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getJsFiles(fullPath));
        } else if (file.endsWith('.js')) {
            results.push(fullPath);
        }
    });
    return results;
}

const jsFiles = getJsFiles('js');
console.log(`Checking syntax of ${jsFiles.length} JavaScript files...`);

let passed = 0;
jsFiles.forEach(f => {
    try {
        execSync(`agy-node --check "${f}"`);
        passed++;
    } catch (e) {
        console.error(`Syntax error in: ${f}`);
        process.exit(1);
    }
});

console.log(`✔ All ${passed} JavaScript files verified without syntax errors!`);
