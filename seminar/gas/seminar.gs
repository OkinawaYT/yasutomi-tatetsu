/**
 * Seminar Response Collector — Google Apps Script Backend
 *
 * 【セットアップ手順】
 * 1. Google スプレッドシートを新規作成する
 * 2. 下の SPREADSHEET_ID をそのシートのIDに書き換える
 * 3. [デプロイ] → [新しいデプロイ] → 種類: ウェブアプリ
 *    - 次のユーザーとして実行: 自分
 *    - アクセスできるユーザー: 全員
 * 4. デプロイURLを seminar/config.json の gas_url に貼り付ける
 *
 * 【スプレッドシート構造】
 * - シート名: {seminar_id}_d{day}_{case_id}
 *   例: kodaikyo_202607_d1_case1
 * - 列: timestamp | seminar_id | day | case_id | name | affiliation | role | [そのcaseの回答field_id...]
 * - 1つのcaseの質問セットは固定なので列は増えない
 * - 新しいJSONを追加しても既存シートは無変更
 */

const SPREADSHEET_ID = '1c0jG_vpedgdWpE7HsEEM9_62yn_pUjXnMVXHmotJuYs';

// ---------------------------------------------------------------------------
// GET: ダッシュボード用データ取得
// ---------------------------------------------------------------------------
function doGet(e) {
  const action    = e.parameter.action;
  const seminarId = e.parameter.seminar_id;
  const day       = e.parameter.day;
  const caseId    = e.parameter.case_id;
  const callback  = e.parameter.callback;

  let result;
  if (action === 'getResults' && seminarId) {
    result = getResults(seminarId, day, caseId);
  } else if (action === 'getRegistrations' && seminarId) {
    result = getRegistrations(seminarId);
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
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'submitAnswers') {
      saveAnswers(data);
      return createJsonResponse({ status: 'success' });
    }
    return createJsonResponse({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  }
}

// ---------------------------------------------------------------------------
// 回答を保存（シート名 = {seminar_id}_d{day}_{case_id}）
// ---------------------------------------------------------------------------
function saveAnswers(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = `${data.seminar_id}_d${data.day}_${data.case_id}`;
  let sheet = ss.getSheetByName(sheetName);

  const rowData = {
    timestamp:   new Date().toISOString(),
    seminar_id:  data.seminar_id  || '',
    day:         data.day         || '',
    case_id:     data.case_id     || '',
    name:        data.name        || '',
    affiliation: data.affiliation || '',
    role:        data.role        || '',
    ...flattenAnswers(data.answers || {}),
  };

  // 新規シート → ヘッダー行を作成（このcaseの質問が列として確定）
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

  // 同一caseでJSONが更新された場合の列追加（通常は発生しない）
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const newKeys = Object.keys(rowData).filter(k => !existingHeaders.includes(k));
  if (newKeys.length > 0) {
    newKeys.forEach((key, i) => {
      const col = existingHeaders.length + i + 1;
      sheet.getRange(1, col)
        .setValue(key)
        .setFontWeight('bold')
        .setBackground('#4f46e5')
        .setFontColor('#ffffff');
    });
  }

  const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const nameIdx = allHeaders.indexOf('name');
  const affIdx  = allHeaders.indexOf('affiliation');

  // 同一人物の既存行を上書き（name + affiliation が一致する場合）
  if (rowData.name && sheet.getLastRow() >= 2) {
    const bodyValues = sheet.getRange(2, 1, sheet.getLastRow() - 1, allHeaders.length).getValues();
    for (let i = 0; i < bodyValues.length; i++) {
      const nameMatch = nameIdx >= 0 && String(bodyValues[i][nameIdx]) === rowData.name;
      const affMatch  = affIdx  <  0 || String(bodyValues[i][affIdx])  === rowData.affiliation;
      if (nameMatch && affMatch) {
        const row = allHeaders.map(h => (rowData[h] !== undefined ? rowData[h] : ''));
        sheet.getRange(i + 2, 1, 1, row.length).setValues([row]);
        return;
      }
    }
  }

  const row = allHeaders.map(h => (rowData[h] !== undefined ? rowData[h] : ''));
  sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
}

function flattenAnswers(answers) {
  const flat = {};
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
function getResults(seminarId, day, caseId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  if (day && caseId) {
    const sheet = ss.getSheetByName(`${seminarId}_d${day}_${caseId}`);
    if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] };
    return readSheet(sheet);
  }

  // 集約: seminarId_ で始まる全シート
  const prefix = `${seminarId}_`;
  const sheets = ss.getSheets().filter(s => s.getName().startsWith(prefix));
  if (!sheets.length) return { headers: [], rows: [] };

  const headerSet = [];
  let allRows = [];

  sheets.forEach(sheet => {
    if (sheet.getLastRow() < 2) return;
    const data = readSheet(sheet);
    data.headers.forEach(h => { if (!headerSet.includes(h)) headerSet.push(h); });
    allRows = allRows.concat(data.rows);
  });

  allRows.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return { headers: headerSet, rows: allRows };
}

// ---------------------------------------------------------------------------
// 参加申込状況データ取得（シート名: {seminar_id}_registrations）
// 列: No | 大学名 | 住所 | 緯度 | 経度 | 合計 | 区分 | 役職・職位 | 人数
// ---------------------------------------------------------------------------
function getRegistrations(seminarId) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(`${seminarId}_registrations`);
  if (!sheet || sheet.getLastRow() < 2) return { headers: [], rows: [] };
  return readSheet(sheet);
}

function readSheet(sheet) {
  const values  = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const rows    = values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : String(row[i]);
    });
    return obj;
  });
  return { headers, rows };
}

// ---------------------------------------------------------------------------
// ユーティリティ
// ---------------------------------------------------------------------------
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
