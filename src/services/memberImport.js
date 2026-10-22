const ExcelJS = require('exceljs');

const HEADERS = ['Nome', 'Telefone', 'Email', 'Grupo'];
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max + 1) : '';
const phoneKey = (value) => String(value || '').replace(/\D/g, '');
const validPhone = (value) => /^\+?[\d ()-]{10,22}$/.test(value) && /^\d{10,15}$/.test(phoneKey(value));
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

function normalizeHeader(val) {
  return String(val || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const EXPECTED_HEADERS = ['nome', 'telefone', 'email', 'grupo'];

function isExpectedHeader(val, expected) {
  const norm = normalizeHeader(val);
  if (expected === 'email') return norm === 'email' || norm === 'correioeletronico';
  return norm === expected;
}

function cellText(cell) {
  if (!cell) return '';
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) ? String(value) : String(Math.round(value)).trim();
  }
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) {
      return value.richText.map((part) => part.text || '').join('').trim();
    }
    if (value.text !== undefined && value.text !== null) {
      if (typeof value.text === 'string') return value.text.trim();
      if (typeof value.text === 'object' && Array.isArray(value.text.richText)) {
        return value.text.richText.map((part) => part.text || '').join('').trim();
      }
    }
    if (value.hyperlink) {
      return String(value.hyperlink).replace(/^mailto:/i, '').trim();
    }
    if (value.result !== undefined && value.result !== null) {
      if (typeof value.result === 'string') return value.result.trim();
      if (typeof value.result === 'number') return String(value.result).trim();
      if (typeof value.result === 'object' && Array.isArray(value.result.richText)) {
        return value.result.richText.map((p) => p.text || '').join('').trim();
      }
    }
  }
  if (typeof cell.text === 'string') return cell.text.trim();
  return null;
}

async function createTemplate() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Equilibra';
  const sheet = workbook.addWorksheet('Pessoas', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: HEADERS[0], key: 'name', width: 32 },
    { header: HEADERS[1], key: 'phone', width: 23 },
    { header: HEADERS[2], key: 'email', width: 36 },
    { header: HEADERS[3], key: 'group', width: 28 }
  ];
  sheet.getRow(1).height = 27;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D684A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  const sampleRows = [
    ['Ana Silva', '(11) 98765-4321', 'ana.silva@exemplo.com.br', 'Operações'],
    ['Bruno Costa', '(11) 98765-4322', 'bruno.costa@exemplo.com.br', 'Financeiro'],
    ['Carla Dias', '(11) 98765-4323', 'carla.dias@exemplo.com.br', '']
  ];

  for (const rowData of sampleRows) {
    const row = sheet.addRow(rowData);
    row.height = 22;
    row.eachCell((cell, colNumber) => {
      cell.font = { size: 11, color: { argb: 'FF333333' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      if (colNumber === 2) cell.numFmt = '@';
    });
  }

  sheet.getColumn(2).numFmt = '@';
  sheet.autoFilter = 'A1:D1';
  return workbook.xlsx.writeBuffer();
}

function parseCsvLine(line, delimiter) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(buffer) {
  let content = buffer.toString('utf8');
  if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
  }
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) throw new Error('A planilha não contém pessoas para cadastrar.');
  if (lines.length - 1 > MAX_ROWS) throw new Error(`Limite de ${MAX_ROWS} pessoas por arquivo.`);

  const headerLine = lines[0];
  const countSemi = (headerLine.match(/;/g) || []).length;
  const countComma = (headerLine.match(/,/g) || []).length;
  const delimiter = countSemi >= countComma ? ';' : ',';

  const headers = parseCsvLine(headerLine, delimiter);
  const validHeaders = HEADERS.every((header, index) => isExpectedHeader(headers[index], EXPECTED_HEADERS[index]));
  const extraHeaders = headers.length > 4 && headers.slice(4).some((h) => h !== '');
  if (!validHeaders || extraHeaders) throw new Error('Formato inválido. A primeira linha precisa ter: Nome, Telefone, Email, Grupo.');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = parseCsvLine(lines[i], delimiter);
    const raw = [parsed[0] || '', parsed[1] || '', parsed[2] || '', parsed[3] || ''];
    const extra = parsed.length > 4 && parsed.slice(4).some((val) => val !== '');
    if (raw.every((val) => val === '') && !extra) continue;
    rows.push({ line: i + 1, raw, extra });
  }
  if (!rows.length) throw new Error('A planilha não contém pessoas para cadastrar.');
  return rows;
}

async function parseImport(fileName, base64) {
  if (typeof fileName !== 'string' || !/\.(xlsx|csv)$/i.test(fileName) || typeof base64 !== 'string') throw new Error('Envie um arquivo .xlsx ou .csv válido.');
  const cleanBase64 = base64.trim().replace(/\s+/g, '');
  if (cleanBase64.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 8 || !/^[A-Za-z0-9+/]+={0,2}$/.test(cleanBase64)) throw new Error('Arquivo inválido ou maior que 1 MB.');
  const buffer = Buffer.from(cleanBase64, 'base64');
  if (!buffer.length || buffer.length > MAX_FILE_BYTES || buffer.toString('base64') !== cleanBase64) throw new Error('Arquivo inválido ou maior que 1 MB.');

  if (/\.csv$/i.test(fileName)) {
    return parseCsv(buffer);
  }

  if (buffer.subarray(0, 2).toString() !== 'PK') throw new Error('Arquivo inválido ou maior que 1 MB.');
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { throw new Error('Não foi possível ler o Excel. Use o template .xlsx fornecido.'); }
  const sheet = workbook.worksheets.find((ws) => ws.name && ws.name.toLowerCase() === 'pessoas') || workbook.worksheets[0];
  if (!sheet) throw new Error('Formato inválido. A primeira linha precisa ter: Nome, Telefone, Email, Grupo.');

  let extraHeaders = false;
  sheet.getRow(1).eachCell((cell, column) => {
    if (column > 4 && cellText(cell) !== '') extraHeaders = true;
  });

  const validHeaders = HEADERS.every((header, index) => isExpectedHeader(cellText(sheet.getRow(1).getCell(index + 1)), EXPECTED_HEADERS[index]));
  if (!validHeaders || extraHeaders) throw new Error('Formato inválido. A primeira linha precisa ter: Nome, Telefone, Email, Grupo.');
  if (sheet.rowCount < 2) throw new Error('A planilha não contém pessoas para cadastrar.');
  if (sheet.rowCount - 1 > MAX_ROWS) throw new Error(`Limite de ${MAX_ROWS} pessoas por arquivo.`);
  const rows = [];
  for (let line = 2; line <= sheet.rowCount; line++) {
    const row = sheet.getRow(line);
    const raw = [cellText(row.getCell(1)), cellText(row.getCell(2)), cellText(row.getCell(3)), cellText(row.getCell(4))];
    let extra = false;
    row.eachCell((cell, column) => { if (column > 4 && cell.value !== null && cellText(cell) !== '') extra = true; });
    if (raw.every((value) => value === '' || value === null) && !extra) continue;
    rows.push({ line, raw, extra });
  }
  if (!rows.length) throw new Error('A planilha não contém pessoas para cadastrar.');
  return rows;
}

function validateImport(rows, existingMembers) {
  const emails = new Set(existingMembers.map((item) => item.email ? item.email.toLowerCase() : '').filter(Boolean));
  const phones = new Set(existingMembers.map((item) => phoneKey(item.phone)).filter(Boolean));
  const checked = rows.map(({ line, raw, extra }) => {
    const [rawName, rawPhone, rawEmail, rawGroup] = raw;
    const name = text(rawName, 120), phone = text(rawPhone, 22), email = text(rawEmail, 254).toLowerCase(), group = (rawGroup === '' || rawGroup === null || rawGroup === undefined) ? 'Geral' : text(rawGroup, 120);
    const errors = [];
    if (!name && !email) errors.push('Nome ou e-mail obrigatório');
    if (name && name.length > 120) errors.push('Nome muito longo');
    if (phone && !validPhone(phone)) errors.push('Telefone inválido');
    if (email && (!validEmail(email) || email.length > 254)) errors.push('E-mail inválido');
    if (!group || group.length > 120) errors.push('Grupo inválido');
    if (raw.includes(null) || extra) errors.push('Valor ou coluna fora do formato');
    if (email && validEmail(email) && emails.has(email)) errors.push('E-mail repetido');
    if (phone && validPhone(phone) && phones.has(phoneKey(phone))) errors.push('Telefone repetido');
    if (email && validEmail(email)) emails.add(email);
    if (phone && validPhone(phone)) phones.add(phoneKey(phone));
    return { line, name, phone, email, group, errors };
  });
  return { rows: checked, valid: checked.filter((row) => row.errors.length === 0).length, invalid: checked.filter((row) => row.errors.length > 0).length };
}

module.exports = { createTemplate, parseImport, validateImport, validPhone, phoneKey };
