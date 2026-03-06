const fs = require('fs');
const path = require('path');

const directoryPath = 'c:/Users/gabor/Downloads/Pasaporte turístico/pasaporte-turistico';

// Colors to replace
const replacements = {
    'slate-950': 'stone-950',
    'slate-900': 'stone-900',
    'slate-800': 'stone-800',
    'slate-700': 'stone-700',
    'slate-600': 'stone-600',
    'slate-500': 'stone-500',
    'slate-400': 'stone-400',
    'slate-300': 'stone-300',
    'slate-200': 'stone-200',
    'slate-100': 'stone-100',
    'slate-50': 'stone-50',
    'text-slate-': 'text-stone-',
    'bg-slate-': 'bg-stone-',
    'border-slate-': 'border-stone-',

    // Changing primary action colors to earthy tones
    'indigo-600': 'emerald-600',
    'indigo-500': 'emerald-500',
    'indigo-400': 'emerald-400',
    'indigo-900': 'emerald-900',
    'indigo-100': 'emerald-100',

    // Secondary colors
    'cyan-600': 'amber-600',
    'cyan-500': 'amber-500',
    'cyan-400': 'amber-400',
    'cyan-900': 'amber-900',
    'cyan-100': 'amber-100',

    // Tertiary/Magic glows
    'purple-600': 'teal-600',
    'purple-500': 'teal-500',
    'purple-400': 'teal-400',
    'purple-900': 'teal-900',
    'purple-100': 'teal-100',
};

function readAndReplace(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        if (file === 'node_modules' || file === '.next' || file === '.git') continue;

        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            readAndReplace(fullPath);
        } else if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css') || file.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let originalContent = content;

            for (const [key, value] of Object.entries(replacements)) {
                // use regex to replace all occurrences globally
                const regex = new RegExp(key, 'g');
                content = content.replace(regex, value);
            }

            if (content !== originalContent) {
                fs.writeFileSync(fullPath, content);
                console.log(`Updated: ${fullPath}`);
            }
        }
    }
}

readAndReplace(directoryPath);
console.log('Color replacement complete!');
