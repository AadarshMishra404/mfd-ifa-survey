/**
 * Google Apps Script backend for the Next-Gen MFD & IFA Practice Survey.
 *
 * Setup (about 5 minutes) — see README.md, "Hosting".
 *   1. Create a Google Sheet → Extensions → Apps Script → paste this whole file.
 *   2. Project Settings (gear) → Script properties → add ADMIN_KEY = <a secret>.
 *   3. Deploy → New deployment → type "Web app"
 *        Execute as: Me    Who has access: Anyone
 *   4. Copy the Web app URL (ends in /exec) into js/config.js → sheetsUrl.
 *
 * POST  (from the survey)    appends one row per response to the "Responses" tab.
 * GET   ?key=ADMIN_KEY       returns every response as JSON (for the dashboard).
 */

// The Google Sheet's ID: the long part of its URL between /d/ and /edit.
// Needed when this script was created at script.google.com rather than from
// the Sheet's Extensions → Apps Script menu. Leave '' if it was made from the Sheet.
const SPREADSHEET_ID = '';

const SHEET_NAME = 'Responses';
const RAW = 'raw_json';   // full response, used by the dashboard

function sheet_() {
  const ss = SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet: set SPREADSHEET_ID at the top of the script');
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const body = JSON.parse(e.postData.contents);
    const response = body.response;
    if (!response || typeof response.answers !== 'object') return out_({ error: 'answers missing' });

    const sh = sheet_();
    const flat = Object.assign({ receivedAt: new Date().toISOString() }, body.flat || {});
    flat[RAW] = JSON.stringify(Object.assign({}, response, { receivedAt: flat.receivedAt }));

    // Headers: create on first write, append any new columns later.
    let headers = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    const missing = Object.keys(flat).filter((k) => headers.indexOf(k) === -1);
    if (missing.length) {
      headers = headers.concat(missing);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }

    // A retried submit carries the same id — don't store it twice.
    const idCol = headers.indexOf('id') + 1;
    if (idCol && response.id && sh.getLastRow() > 1) {
      const hit = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).createTextFinder(String(response.id)).matchEntireCell(true).findNext();
      if (hit) return out_({ ok: true, duplicate: true });
    }

    sh.appendRow(headers.map((h) => (flat[h] === undefined ? '' : flat[h])));
    return out_({ ok: true, id: response.id });
  } catch (err) {
    return out_({ error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  if (!key || (e.parameter && e.parameter.key) !== key) return out_({ error: 'key required' });

  try {
    const sh = sheet_();
    if (sh.getLastRow() < 2) return out_([]);
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const col = headers.indexOf(RAW);
    if (col === -1) return out_([]);
    const rows = sh.getRange(2, col + 1, sh.getLastRow() - 1, 1).getValues();
    const list = [];
    rows.forEach((r) => { try { list.push(JSON.parse(r[0])); } catch (err) { /* skip hand-edited rows */ } });
    return out_(list);
  } catch (err) {
    return out_({ error: String(err) });
  }
}
