const fs = require('fs');
const cp = require('child_process');

function extractDocx(filename) {
  const xml = cp.execSync(`tar.exe -x -O -f "${filename}" word/document.xml`, { maxBuffer: 30 * 1024 * 1024 }).toString('utf8');
  
  const text = xml
    .replace(/<w:pPr>[\s\S]*?<\/w:pPr>/g, '') // remove paragraph props
    .replace(/<\/w:p>/g, '\n\n')
    .replace(/<\/w:tr>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

try {
  const diffText = extractDocx('SettleFlow_Differentiation.docx');
  fs.writeFileSync('docs/SettleFlow_Differentiation.md', '# SettleFlow Differentiation\n\n' + diffText);
  console.log('Saved docs/SettleFlow_Differentiation.md (' + diffText.length + ' chars)');

  const prdText = extractDocx('SettleFlow_PRD.docx');
  fs.writeFileSync('docs/SettleFlow_PRD.md', '# SettleFlow PRD\n\n' + prdText);
  console.log('Saved docs/SettleFlow_PRD.md (' + prdText.length + ' chars)');
} catch (err) {
  console.error('Error extracting docx:', err);
}
