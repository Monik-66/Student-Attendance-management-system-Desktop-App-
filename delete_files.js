const fs = require('fs');
const path = require('path');

const filesToDelete = [
    'load_students_from_csv.js',
    'load_teachers_from_csv.js',
    'load_sections_from_csv.js',
    'create_teacher_mappings.js',
    'csv_helper.js',
    'extract_pdf_to_csv.js',
    'setup_checklist.js',
    'DATA_UPLOAD_GUIDE.md',
    'DATA_UPLOAD_TOOLKIT.md',
    'DATA_UPLOAD_QUICK_REFERENCE.md',
    'SETUP_COMPLETE.md',
    'README_DATA_UPLOAD.md',
    'TOOLKIT_READY.txt'
];

const baseDir = __dirname;

console.log('Deleting created files...\n');

let deletedCount = 0;
let notFoundCount = 0;

filesToDelete.forEach(file => {
    const filePath = path.join(baseDir, file);
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`✓ Deleted: ${file}`);
            deletedCount++;
        } else {
            console.log(`✗ Not found: ${file}`);
            notFoundCount++;
        }
    } catch (error) {
        console.log(`✗ Error deleting ${file}: ${error.message}`);
    }
});

console.log(`\n✅ Complete!`);
console.log(`   Deleted: ${deletedCount}`);
console.log(`   Not found: ${notFoundCount}`);

// Delete this script itself
setTimeout(() => {
    try {
        fs.unlinkSync(__filename);
        console.log(`✓ Cleanup script deleted`);
    } catch (e) {
        console.log(`Note: Cleanup script still exists at ${__filename}`);
    }
}, 500);
