/**
 * Seminar Response Collector — Google Apps Script Backend
 *
 * 【初回セットアップ】
 * 1. clasp push 後、GAS エディタで setupProperties() を一度だけ実行する
 *    (スプレッドシート ID を Script Properties に保存する)
 * 2. [デプロイ] → [新しいデプロイ] → 種類: ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 3. デプロイURLを seminar/config.json の gas_url に貼り付ける
 *
 * 【新しいセミナー・シートの追加】
 * → コード変更不要。seminar/config.json にエントリを追加するだけ。
 * → 別スプレッドシートが必要な場合のみ setupProperties() を再実行。
 *
 * 【スプレッドシート構造】
 * SPREADSHEET_ANSWERS:
 *   - シート名: {seminar_id}_d{day}_{case_id}  (例: kodaikyo_202607_d1_case1)
 *   - シート名: {seminar_id}_registrations      (参加者登録)
 * SPREADSHEET_QA:
 *   - シート名: 任意 (config.json の qa_sessions[].sheet と一致させる)
 *   - 列構造: 「質問」列と「質問回答」列のペアを自動検出
 */

// ---------------------------------------------------------------------------
// Script Properties（GAS エディタ Project Settings > Script properties で設定）
// ---------------------------------------------------------------------------
const _props = PropertiesService.getScriptProperties();

function getProp(key: string): string {
  const val = _props.getProperty(key);
  if (!val) throw new Error(`Script property "${key}" が未設定です。setupProperties() を実行してください。`);
  return val;
}

/**
 * 初回セットアップ関数。
 * GAS エディタの「実行」メニューからこの関数を選んで一度だけ実行する。
 * スプレッドシート ID は GitHub に含まれず、GAS の内部に安全に保存される。
 */
function setupProperties(): void {
  PropertiesService.getScriptProperties().setProperties({
    'SPREADSHEET_ANSWERS': 'YOUR_SPREADSHEET_ID',     // 回答シートのスプレッドシートID
    'SPREADSHEET_QA':      'YOUR_QA_SPREADSHEET_ID',  // QAシートのスプレッドシートID
  });
  Logger.log('Script properties を設定しました。checkProperties() で確認できます。');
}

/** 現在の Script Properties を確認（GAS エディタから実行） */
function checkProperties(): void {
  const p = PropertiesService.getScriptProperties().getProperties();
  Logger.log(JSON.stringify(p, null, 2));
}

// ---------------------------------------------------------------------------
// GET: ダッシュボード用データ取得
// ---------------------------------------------------------------------------
function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  const action    = e.parameter.action    || '';
  const seminarId = e.parameter.seminar_id || '';
  const day       = e.parameter.day       || '';
  const caseId    = e.parameter.case_id   || '';
  const callback  = e.parameter.callback  || '';
  const sheetName = e.parameter.sheet_name || e.parameter.sheetName || e.parameter.sheet || '';

  let result: object;
  if (action === 'getResults' && seminarId) {
    result = getResults(seminarId, day, caseId);
  } else if (action === 'getRegistrations' && seminarId) {
    result = getRegistrations(seminarId);
  } else if (action === 'getQaResults' || action === 'getQAResults' || action === 'qa') {
    result = getQaResults(sheetName);
  } else {
    result = { status: 'ok', message: 'Seminar GAS is running' };
  }

  const json = JSON.stringify(result);
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${json})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------------------
// POST: 回答の保存
// ---------------------------------------------------------------------------
function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'submitAnswers') {
      saveAnswers(data);
      return createJsonResponse({ status: 'success' });
    }
    return createJsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: String(err) });
  }
}

// ---------------------------------------------------------------------------
// 回答を保存（シート名 = {seminar_id}_d{day}_{case_id}）
// ---------------------------------------------------------------------------
function saveAnswers(data: Record<string, any>): void {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(getProp('SPREADSHEET_ANSWERS'));
    const sheetName = `${data.seminar_id}_d${data.day}_${data.case_id}`;
    let sheet = ss.getSheetByName(sheetName);

    const rowData: Record<string, string> = {
      timestamp:   new Date().toISOString(),
      seminar_id:  data.seminar_id  || '',
      day:         data.day         || '',
      case_id:     data.case_id     || '',
      name:        data.name        || '',
      affiliation: data.affiliation || '',
      role:        data.role        || '',
      ...flattenAnswers(data.answers || {}),
    };

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      const headers = Object.keys(rowData);
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#4f46e5')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
    const newKeys = Object.keys(rowData).filter(k => !existingHeaders.includes(k));
    if (newKeys.length > 0) {
      newKeys.forEach((key, i) => {
        const col = existingHeaders.length + i + 1;
        sheet!.getRange(1, col)
          .setValue(key)
          .setFontWeight('bold')
          .setBackground('#4f46e5')
          .setFontColor('#ffffff');
      });
    }

    const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] as string[];
    const nameIdx = allHeaders.indexOf('name');
    const affIdx  = allHeaders.indexOf('affiliation');

    if (rowData.name && sheet.getLastRow() >= 2) {
      const bodyValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, allHeaders.length).getValues() as string[][];
      for (let i = 0; i < bodyValues.length; i++) {
        const nameMatch = nameIdx >= 0 && bodyValues[i][nameIdx] === rowData.name;
        const affMatch  = affIdx  <  0 || bodyValues[i][affIdx]  === rowData.affiliation;
        if (nameMatch && affMatch) {
          const row = allHeaders.map(h => rowData[h] !== undefined ? rowData[h] : '');
          sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
          return;
        }
      }
    }

    const row = allHeaders.map(h => rowData[h] !== undefined ? rowData[h] : '');
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function flattenAnswers(answers: Record<string, any>): Record<string, string> {
  const flat: Record<string, string> = {};
  Object.entries(answers).forEach(([key, val]) => {
    flat[key] = String(val);
  });
  return flat;
}

// ---------------------------------------------------------------------------
// 回答データ取得
// day + case_id 指定あり → 対象シート1枚を返す
// 指定なし        → seminarId_ で始まる全シートを集約して返す
// ---------------------------------------------------------------------------
function getResults(seminarId: string, day?: string, caseId?: string): object {
  const ss = SpreadsheetApp.openById(getProp('SPREADSHEET_ANSWERS'));

  if (day && caseId) {
    const sheet = ss.getSheetByName(`${seminarId}_d${day}_${caseId}`);
    if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] };
    return readSheet(sheet);
  }

  const prefix = `${seminarId}_`;
  const sheets = ss.getSheets().filter(s =>
    s.getName().startsWith(prefix) && !s.getName().endsWith('_registrations')
  );
  if (!sheets.length) return { headers: [], rows: [] };

  const headerSet: string[] = [];
  let allRows: object[] = [];

  sheets.forEach(sheet => {
    if (sheet.getLastRow() < 2) return;
    const data = readSheet(sheet) as { headers: string[]; rows: object[] };
    data.headers.forEach(h => { if (!headerSet.includes(h)) headerSet.push(h); });
    allRows = allRows.concat(data.rows);
  });

  allRows.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return { headers: headerSet, rows: allRows };
}

// ---------------------------------------------------------------------------
// 参加申込状況データ取得（シート名: {seminar_id}_registrations）
// ---------------------------------------------------------------------------
function getRegistrations(seminarId: string): object {
  const ss = SpreadsheetApp.openById(getProp('SPREADSHEET_ANSWERS'));
  const sheet = ss.getSheetByName(`${seminarId}_registrations`);
  if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] };
  return readSheet(sheet);
}

function readSheet(sheet: GoogleAppsScript.Spreadsheet.Sheet): { headers: string[]; rows: object[] } {
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rows    = values.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? (row[i] as Date).toISOString() : String(row[i]);
    });
    return obj;
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// QA スプレッドシート読み取り
// 「X」列と「X回答」列のペアを自動検出してデータを返す
// ---------------------------------------------------------------------------
function getQaResults(sheetName: string): object {
  const ss    = SpreadsheetApp.openById(getProp('SPREADSHEET_QA'));
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return { pairs: [], rows: [] };

  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);

  const pairs: { q_col: string; a_col: string }[] = [];
  headers.forEach(h => {
    if (h && !h.endsWith('回答') && headers.includes(h + '回答')) {
      pairs.push({ q_col: h, a_col: h + '回答' });
    }
  });

  const rows = values.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? (row[i] as Date).toISOString() : String(row[i]);
    });
    return obj;
  });

  return { pairs, rows };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function createJsonResponse(data: object): GoogleAppsScript.Content.TextOutput {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
