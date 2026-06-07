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
 * - セミナーIDごとにシートが自動作成される
 * - 列: timestamp | seminar_id | day | case_id | name | affiliation | role | [各回答field_id...]
 * - 新しいJSONで新しいフィールドが出現しても列を自動追加する
 */

const SPREADSHEET_ID = '1c0jG_vpedgdWpE7HsEEM9_62yn_pUjXnMVXHmotJuYs';

// ---------------------------------------------------------------------------
// GET: ダッシュボード用データ取得
// ---------------------------------------------------------------------------
function doGet(e) {
  const action     = e.parameter.action;
  const seminarId  = e.parameter.seminar_id;
  const callback   = e.parameter.callback; // JSONP対応

  let result;

  if (action === 'getResults' && seminarId) {
    result = getResults(seminarId);
  } else {
    result = { status: 'ok', message: 'Seminar GAS is running' };
  }

  const json = JSON.stringify(result);

  // JSONP形式で返す（CORSを回避）
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
// 回答を保存
// ---------------------------------------------------------------------------
function saveAnswers(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheetName = data.seminar_id;
  let sheet = ss.getSheetByName(sheetName);

  // 固定フィールド + 回答フィールドを統合
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

  // シートが存在しない場合は新規作成＋ヘッダー行を追加
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

  // 既存ヘッダーに存在しない列を末尾に追加
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

  // 最新ヘッダーで行を組み立てて追記
  const allHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const row = allHeaders.map(h => (rowData[h] !== undefined ? rowData[h] : ''));
  sheet.appendRow(row);
}

// matrix_parts のネストした回答をフラットなオブジェクトに変換
function flattenAnswers(answers) {
  const flat = {};
  Object.entries(answers).forEach(([key, val]) => {
    flat[key] = String(val);
  });
  return flat;
}

// ---------------------------------------------------------------------------
// 回答データを取得してダッシュボードへ返す
// ---------------------------------------------------------------------------
function getResults(seminarId) {
  const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(seminarId);

  if (!sheet || sheet.getLastRow() < 2) {
    return { headers: [], rows: [] };
  }

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
