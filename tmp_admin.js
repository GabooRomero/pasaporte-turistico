const fs = require('fs');
const path = 'c:/Users/gabor/Downloads/Pasaporte turístico/pasaporte-turistico/app/admin/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace dark hex colors with nature/light ones
content = content.replace(/bg-\[#0B0F19\]/g, 'bg-transparent');
content = content.replace(/bg-\[#111827\]/g, 'bg-white/70 backdrop-blur-md');
content = content.replace(/bg-\[#1F2937\]/g, 'bg-white');
content = content.replace(/hover:bg-\[#1F2937\]/g, 'hover:bg-stone-100');
content = content.replace(/bg-\[#4F46E5\]/g, 'bg-emerald-600');
content = content.replace(/text-\[#4F46E5\]/g, 'text-emerald-600');
content = content.replace(/hover:bg-\[#4338CA\]/g, 'hover:bg-emerald-700');
content = content.replace(/ring-\[#4F46E5\]/g, 'ring-emerald-600');
content = content.replace(/border-\[#4F46E5\]/g, 'border-emerald-600');

// Replace Gray strokes and borders
content = content.replace(/border-gray-800/g, 'border-stone-200');
content = content.replace(/border-gray-700/g, 'border-stone-300');
content = content.replace(/border-gray-500/g, 'border-stone-400');
content = content.replace(/hover:border-gray-500/g, 'hover:border-emerald-500');

// Replace Text Colors
content = content.replace(/text-white/g, 'text-stone-900');
content = content.replace(/text-gray-300/g, 'text-stone-700');
content = content.replace(/text-gray-400/g, 'text-stone-600');
content = content.replace(/text-gray-500/g, 'text-stone-500');
content = content.replace(/hover:text-white/g, 'hover:text-stone-900');

// Custom tweaks for UI legibility
content = content.replace(/Badge className="bg-emerald-600 text-stone-900/g, 'Badge className="bg-emerald-600 text-white');
content = content.replace(/Loader2 className="h-8 w-8 animate-spin text-emerald-600" \/>\\n            <\/div>/g, 'Loader2 className="h-8 w-8 animate-spin text-emerald-600" />\\n            </div>');

fs.writeFileSync(path, content, 'utf8');
console.log('Admin Page refactored to light theme.');
