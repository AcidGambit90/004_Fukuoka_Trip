/**
 * ============================================================================
 * FUKUOKA TRAVEL COMPANION & SPOT EXPLORER
 * Google Apps Script Backend (code.gs)
 * ============================================================================
 * 
 * Synchronizes and serves data from Google Sheets ('PI_Japan_list') to a
 * responsive, modern mobile web app built with Tailwind CSS.
 * 
 * Features:
 * - Real-time sync with Google Sheets (PI_Japan_list)
 * - Multi-attribute search and filtering (Station, Category, Rating, Starred)
 * - Travel Expense Tracker sync (persisted to 'Expenses' sheet)
 * - Flight Schedule & Departure timer support
 * - REST API endpoint support via doGet(e) for testing or external fetching
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  // Spreadsheet ID from your Google Sheets URL
  SPREADSHEET_ID: '1yfaW28yFr-fTCeJYxHTpIVdeTADmDnHAfcYZnVXCJ38',
  
  // Name of the main spots sheet (default: Fukuoka_list)
  SPOTS_SHEET_NAME: 'Fukuoka_list',
  
  // Name of the expenses sheet (auto-created if not exists)
  EXPENSES_SHEET_NAME: 'Expenses',
  
  // App Title
  APP_TITLE: 'Fukuoka Explorer | คู่มือนำเที่ยวฟุกุโอกะ'
};

// ============================================================================
// WEB APP ENTRY POINT (doGet)
// ============================================================================

/**
 * Handles HTTP GET requests to the Web App.
 * Serves index.html or returns JSON API data if requested with ?action=...
 * 
 * @param {Object} e - Event parameter containing query parameters
 * @return {HtmlOutput|TextOutput}
 */
function doGet(e) {
  // Check for JSON API action parameter
  const action = e && e.parameter ? e.parameter.action : null;
  
  if (action === 'getSpots') {
    return createJsonResponse(getSpotsData());
  } else if (action === 'getExpenses') {
    return createJsonResponse(getExpenses());
  } else if (action === 'fixFukuokaColumns') {
    return createJsonResponse({ success: true, message: fixFukuokaSheetColumns() });
  } else if (action === 'fixExpensesHeader') {
    return createJsonResponse({ success: true, message: fixExpensesSheetHeader() });
  }
  
  // Render Frontend HTML
  try {
    const template = HtmlService.createTemplateFromFile('index');
    
    // Evaluate template and configure viewport & mobile permissions
    const htmlOutput = template.evaluate()
      .setTitle(CONFIG.APP_TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
    return htmlOutput;
  } catch (error) {
    Logger.log('Error rendering index.html: ' + error.message);
    return HtmlService.createHtmlOutput(
      '<div style="font-family:sans-serif;padding:24px;text-align:center;">' +
      '<h2>Application Error</h2>' +
      '<p>' + error.message + '</p>' +
      '<p>Please ensure index.html exists in your Google Apps Script project.</p>' +
      '</div>'
    );
  }
}

/**
 * Helper to return formatted JSON TextOutput
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================================
// SPREADSHEET ACCESS & DATA SYNC
// ============================================================================

/**
 * Helper function to retrieve the active or specified spreadsheet.
 * Tries SPREADSHEET_ID first; falls back to getActiveSpreadsheet().
 * 
 * @return {Spreadsheet}
 */
function getSpreadsheet() {
  try {
    if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '') {
      return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    }
  } catch (err) {
    Logger.log('Unable to open by ID, falling back to active sheet: ' + err.message);
  }
  
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw new Error('Spreadsheet not found. Please verify SPREADSHEET_ID or bind this script to a Google Sheet.');
  }
  return active;
}

/**
 * Fetches all curated spots from Google Sheet 'PI_Japan_list'.
 * Automatically detects column indexes, parses types, and calculates summary metrics.
 * 
 * @return {Object} Result object containing spot list, unique stations, and categories
 */
function getSpotsData() {
  try {
    const ss = getSpreadsheet();
    
    // Find target sheet by name or fallback to PI_Japan_list or the first sheet
    let sheet = ss.getSheetByName(CONFIG.SPOTS_SHEET_NAME) || ss.getSheetByName('PI_Japan_list');
    if (!sheet) {
      const sheets = ss.getSheets();
      if (sheets.length > 0) {
        sheet = sheets[0];
      } else {
        throw new Error('No sheets found in spreadsheet.');
      }
    }
    
    const values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) {
      return {
        success: true,
        data: [],
        stations: [],
        types: [],
        total: 0
      };
    }
    
    // Extract headers (first row) and normalize to lowercase
    const headers = values[0].map(function(h) {
      return String(h).trim().toLowerCase();
    });
    
    // Find column indexes dynamically
    const colIndex = {
      flag: findHeaderIndex(headers, ['flag', 'hag']),
      rating: findHeaderIndex(headers, ['rating', 'คะแนน']),
      type: findHeaderIndex(headers, ['type', 'ประเภท', 'หมวดหมู่', 'category']),
      station: findHeaderIndex(headers, ['station', 'สถานี']),
      shop: findHeaderIndex(headers, ['shop', 'ร้าน', 'ชื่อร้าน', 'name', 'place']),
      location: findHeaderIndex(headers, ['location', 'ที่ตั้ง', 'พิกัด', 'สาขา']),
      desc: findHeaderIndex(headers, ['desc', 'description', 'รายละเอียด', 'เมนู', 'note']),
      mapsPhoto: findHeaderIndex(headers, ['maps_photo', 'photo', 'image', 'รูป']),
      mapsRating: findHeaderIndex(headers, ['maps_rating', 'google_rating'])
    };
    
    const spots = [];
    const stationSet = {};
    const typeSet = {};
    let starredCount = 0;
    
    // Iterate over data rows
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      
      // Extract shop name (skip blank rows)
      const shopName = colIndex.shop >= 0 && row[colIndex.shop] ? String(row[colIndex.shop]).trim() : '';
      if (!shopName) continue;
      
      const flagVal = colIndex.flag >= 0 && row[colIndex.flag] ? String(row[colIndex.flag]).trim() : '';
      const ratingRaw = colIndex.rating >= 0 ? row[colIndex.rating] : null;
      let ratingNum = parseFloat(ratingRaw);
      if (isNaN(ratingNum)) {
        ratingNum = 7.0; // Sensible default
      }
      
      const typeVal = colIndex.type >= 0 && row[colIndex.type] ? String(row[colIndex.type]).trim() : 'General';
      const stationVal = colIndex.station >= 0 && row[colIndex.station] ? String(row[colIndex.station]).trim() : 'Fukuoka';
      const locationVal = colIndex.location >= 0 && row[colIndex.location] ? String(row[colIndex.location]).trim() : '';
      const descVal = colIndex.desc >= 0 && row[colIndex.desc] ? String(row[colIndex.desc]).trim() : '';
      const photoVal = colIndex.mapsPhoto >= 0 && row[colIndex.mapsPhoto] ? String(row[colIndex.mapsPhoto]).trim() : '';
      const mapsRatingVal = colIndex.mapsRating >= 0 && row[colIndex.mapsRating] ? String(row[colIndex.mapsRating]).trim() : '';
      
      if (stationVal) stationSet[stationVal] = true;
      if (typeVal) typeSet[typeVal] = true;
      if (flagVal.indexOf('*') >= 0) starredCount++;
      
      spots.push({
        id: i,
        flag: flagVal,
        rating: ratingNum,
        type: typeVal,
        station: stationVal,
        shop: shopName,
        location: locationVal,
        desc: descVal,
        mapsPhoto: photoVal,
        mapsRating: mapsRatingVal,
        // Pre-generate convenient Google Maps search query
        mapsUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(shopName + ' ' + (locationVal || stationVal || '') + ' Fukuoka Japan')
      });
    }
    
    // Sort spots: highest rated and flagged first
    spots.sort(function(a, b) {
      const aIsStar = a.flag.indexOf('**') >= 0 ? 2 : (a.flag.indexOf('*') >= 0 ? 1 : 0);
      const bIsStar = b.flag.indexOf('**') >= 0 ? 2 : (b.flag.indexOf('*') >= 0 ? 1 : 0);
      if (bIsStar !== aIsStar) {
        return bIsStar - aIsStar;
      }
      return b.rating - a.rating;
    });
    
    const uniqueStations = Object.keys(stationSet).sort();
    const uniqueTypes = Object.keys(typeSet).sort();
    
    return {
      success: true,
      data: spots,
      stations: uniqueStations,
      types: uniqueTypes,
      total: spots.length,
      starredCount: starredCount,
      updatedAt: new Date().toISOString()
    };
  } catch (error) {
    Logger.log('Error fetching spots data: ' + error.message);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

/**
 * Utility to match header names against potential candidate synonyms
 */
function findHeaderIndex(headers, candidates) {
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    for (let c = 0; c < candidates.length; c++) {
      if (h === candidates[c] || h.indexOf(candidates[c]) >= 0) {
        return i;
      }
    }
  }
  return -1;
}

// ============================================================================
// EXPENSE TRACKER (Optional Tab)
// ============================================================================

/**
 * Retrieves or creates the 'Expenses' sheet in the spreadsheet
 * Automatically verifies and fixes mismatched header columns
 */
function getOrCreateExpensesSheet(ss) {
  let sheet = ss.getSheetByName(CONFIG.EXPENSES_SHEET_NAME);
  const correctHeaders = ['ID', 'Date', 'Item', 'Category', 'Person', 'Amount_JPY', 'Amount_THB', 'Note', 'Timestamp'];
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.EXPENSES_SHEET_NAME);
    // Setup header row with Person column
    sheet.appendRow(correctHeaders);
    sheet.getRange(1, 1, 1, correctHeaders.length).setFontWeight('bold').setBackground('#F3EFEA');
    sheet.setFrozenRows(1);
  } else {
    // Check if the current header row has mismatched or missing Person column
    const lastCol = Math.max(sheet.getLastColumn(), correctHeaders.length);
    const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const headerStr = currentHeaders.map(function(h) { return String(h).trim().toLowerCase(); }).join(',');
    
    // If 'person' is missing from header (e.g. old 8-column header), auto-correct row 1
    if (!headerStr.includes('person') && !headerStr.includes('คนจ่าย')) {
      sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
      sheet.getRange(1, 1, 1, correctHeaders.length).setFontWeight('bold').setBackground('#F3EFEA');
      sheet.setFrozenRows(1);
    }
  }
  return sheet;
}

/**
 * Utility function to immediately fix and align Expenses sheet headers with data
 */
function fixExpensesSheetHeader() {
  const ss = getSpreadsheet();
  const sheet = getOrCreateExpensesSheet(ss);
  const correctHeaders = ['ID', 'Date', 'Item', 'Category', 'Person', 'Amount_JPY', 'Amount_THB', 'Note', 'Timestamp'];
  sheet.getRange(1, 1, 1, correctHeaders.length).setValues([correctHeaders]);
  sheet.getRange(1, 1, 1, correctHeaders.length).setFontWeight('bold').setBackground('#F3EFEA');
  sheet.setFrozenRows(1);
  Logger.log('Fixed Expenses headers: ' + correctHeaders.join(', '));
  return 'Fixed Expenses headers successfully!';
}

/**
 * Adds an expense item to the Google Sheet
 * 
 * @param {Object} expense - { date, item, category, person, amountJPY, amountTHB, note }
 * @return {Object} result
 */
function addExpense(expense) {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateExpensesSheet(ss);
    
    const id = 'EXP-' + new Date().getTime();
    const now = new Date();
    const dateStr = expense.date || Utilities.formatDate(now, 'GMT+7', 'yyyy-MM-dd');
    const item = expense.item || 'Expense';
    const category = expense.category || 'อาหาร & เครื่องดื่ม';
    const person = expense.person || expense.user || 'All'; // 'Pi', 'Pung', 'All'
    const amountJPY = parseFloat(expense.amountJPY) || 0;
    const amountTHB = parseFloat(expense.amountTHB) || Math.round(amountJPY * 0.23);
    const note = expense.note || '';
    
    sheet.appendRow([id, dateStr, item, category, person, amountJPY, amountTHB, note, now.toISOString()]);
    
    return {
      success: true,
      id: id,
      message: 'Expense recorded successfully'
    };
  } catch (error) {
    Logger.log('Error adding expense: ' + error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetches all expenses from the Google Sheet
 * 
 * @return {Object}
 */
function getExpenses() {
  try {
    const ss = getSpreadsheet();
    const sheet = getOrCreateExpensesSheet(ss);
    if (!sheet) {
      return { success: true, data: [], totalJPY: 0, totalTHB: 0 };
    }
    
    const values = sheet.getDataRange().getValues();
    if (!values || values.length <= 1) {
      return { success: true, data: [], totalJPY: 0, totalTHB: 0 };
    }
    
    // Check headers to detect column indexes dynamically
    const headers = values[0].map(function(h) { return String(h).trim().toLowerCase(); });
    const colPerson = findHeaderIndex(headers, ['person', 'user', 'คนจ่าย', 'ผู้ใช้']);
    const colJpy = findHeaderIndex(headers, ['amount_jpy', 'jpy', 'เยน']);
    const colThb = findHeaderIndex(headers, ['amount_thb', 'thb', 'บาท']);
    
    const expenses = [];
    let totalJPY = 0;
    let totalTHB = 0;
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const id = row[0] ? String(row[0]) : 'EXP-' + i;
      let date = '';
      if (row[1] instanceof Date) {
        date = Utilities.formatDate(row[1], 'GMT+7', 'yyyy-MM-dd');
      } else {
        date = row[1] ? String(row[1]).trim() : '';
      }
      const item = row[2] ? String(row[2]) : '';
      const category = row[3] ? String(row[3]) : 'Food';
      
      // Determine person
      let person = 'All';
      if (colPerson >= 0 && row[colPerson]) {
        person = String(row[colPerson]).trim();
      } else if (row.length >= 9 && row[4]) {
        // If 9 columns, col 4 is person
        person = String(row[4]).trim();
      }
      
      const amountJPY = parseFloat(colJpy >= 0 ? row[colJpy] : (row.length >= 9 ? row[5] : row[4])) || 0;
      const amountTHB = parseFloat(colThb >= 0 ? row[colThb] : (row.length >= 9 ? row[6] : row[5])) || 0;
      const note = (row.length >= 9 ? (row[7] || '') : (row[6] || ''));
      
      totalJPY += amountJPY;
      totalTHB += amountTHB;
      
      expenses.push({
        id: id,
        date: date,
        item: item,
        category: category,
        person: person,
        amountJPY: amountJPY,
        amountTHB: amountTHB,
        note: String(note)
      });
    }
    
    return {
      success: true,
      data: expenses.reverse(), // Most recent first
      totalJPY: totalJPY,
      totalTHB: totalTHB,
      count: expenses.length
    };
  } catch (error) {
    Logger.log('Error getting expenses: ' + error.message);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
}

// ============================================================================
// FLIGHT SCHEDULE & TIMING (Optional Tab)
// ============================================================================

/**
 * Returns saved return flight schedule information
 * 
 * @return {Object}
 */
function getFlightInfo() {
  const props = PropertiesService.getScriptProperties();
  const savedJson = props.getProperty('RETURN_FLIGHT_DATA');
  
  if (savedJson) {
    try {
      return { success: true, data: JSON.parse(savedJson) };
    } catch (e) {
      // fallback to default
    }
  }
  
  // Default Fukuoka Departure reference
  const defaultFlight = {
    airline: 'Thai AirAsia / Thai Airways',
    flightNo: 'FD737 / TG649',
    route: 'Fukuoka (FUK) → Bangkok (DMK / BKK)',
    departureAirport: 'Fukuoka Airport (FUK) - International Terminal',
    departureTime: '11:55',
    departureDate: '2026-10-15',
    checkinDeadline: '3 hours prior to departure',
    transitTip: 'Take Kuko Subway Line to Fukuoka Airport Domestic Terminal (2 stops from Hakata, ~6 mins), then take the free airport shuttle bus (10-15 mins) to International Terminal.',
    notes: 'Remember to complete tax-free customs scan and spend remaining JPY coins before boarding.'
  };
  
  return { success: true, data: defaultFlight };
}

/**
 * Saves or updates return flight details
 * 
 * @param {Object} flightData
 * @return {Object}
 */
function saveFlightInfo(flightData) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('RETURN_FLIGHT_DATA', JSON.stringify(flightData));
    return { success: true, message: 'Flight schedule updated' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// GOOGLE PLACES API PHOTO POPULATION HELPER (Optional Admin Utility)
// ============================================================================

/**
 * ดึงรูปร้านจาก Google Places API ลงในคอลัมน์ 'maps_photo' ใน Google Sheet อัตโนมัติ
 * (จำเป็นต้องใส่ Google Places API Key ใน Script Properties: 'PLACES_API_KEY')
 * 
 * วิธีใช้:
 * 1. ใส่ Key ใน การตั้งค่าโครงการ (Project Settings) -> ข้อมูลพร็อพเพอร์ตี้ของสคริปต์ (Script Properties) -> PLACES_API_KEY
 * 2. กดสั่งรันฟังก์ชัน `fetchAndFillPlacePhotos()` นี้ใน Apps Script
 */
function fetchAndFillPlacePhotos() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('PLACES_API_KEY');
  if (!apiKey) {
    Logger.log('กรุณาตั้งค่า PLACES_API_KEY ใน Script Properties ก่อนใช้งาน');
    return 'Missing PLACES_API_KEY';
  }

  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Fukuoka_list') || ss.getSheetByName(CONFIG.SPOTS_SHEET_NAME) || ss.getSheetByName('PI_Japan_list') || ss.getSheets()[0];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 'No data';

  const headers = data[0].map(h => String(h).trim().toLowerCase());
  let photoColIdx = findHeaderIndex(headers, ['maps_photo', 'photo', 'image', 'รูป']);
  const shopColIdx = findHeaderIndex(headers, ['shop', 'ร้าน', 'ชื่อร้าน', 'name']);
  const locColIdx = findHeaderIndex(headers, ['location', 'ที่ตั้ง', 'พิกัด']);
  const stationColIdx = findHeaderIndex(headers, ['station', 'สถานี']);

  // ถ้ายังไม่มีคอลัมน์ maps_photo ให้สร้างต่อท้าย
  if (photoColIdx === -1) {
    photoColIdx = headers.length;
    sheet.getRange(1, photoColIdx + 1).setValue('maps_photo');
  }

  let updatedCount = 0;
  Logger.log(`Found ${data.length - 1} rows to inspect in sheet "${sheet.getName()}". photoColIdx: ${photoColIdx}, shopColIdx: ${shopColIdx}`);

  for (let i = 1; i < data.length; i++) {
    const existingPhoto = data[i][photoColIdx];
    if (existingPhoto && String(existingPhoto).trim().startsWith('http')) {
      continue; // มีรูปอยู่แล้ว ข้ามได้เลย
    }

    const shop = data[i][shopColIdx];
    if (!shop) continue;

    const loc = locColIdx >= 0 ? (data[i][locColIdx] || '') : '';
    const station = stationColIdx >= 0 ? (data[i][stationColIdx] || 'Fukuoka') : 'Fukuoka';
    const textQuery = `${shop} ${loc} ${station} Fukuoka Japan`;

    try {
      // 1. ลองใช้ Places API (New) - Text Search
      const newApiUrl = 'https://places.googleapis.com/v1/places:searchText';
      const newApiPayload = {
        textQuery: textQuery,
        languageCode: 'ja',
        maxResultCount: 1
      };
      const newApiRes = UrlFetchApp.fetch(newApiUrl, {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.photos'
        },
        payload: JSON.stringify(newApiPayload),
        muteHttpExceptions: true
      });

      const newApiText = newApiRes.getContentText();
      const newApiJson = JSON.parse(newApiText);

      if (newApiJson.places && newApiJson.places.length > 0 && newApiJson.places[0].photos && newApiJson.places[0].photos.length > 0) {
        const photoName = newApiJson.places[0].photos[0].name; // รูปแบบ: places/.../photos/...
        const photoUrl = `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=600&key=${apiKey}`;
        sheet.getRange(i + 1, photoColIdx + 1).setValue(photoUrl);
        updatedCount++;
        Logger.log(`[New API] Added photo for ${shop}`);
        Utilities.sleep(150);
        continue;
      }

      // 2. ถ้าไม่พบหรือ New API ปิดอยู่ ลองใช้ Legacy Places API (Text Search)
      const legacyUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(textQuery)}&key=${apiKey}&language=ja`;
      const legacyRes = UrlFetchApp.fetch(legacyUrl, { muteHttpExceptions: true });
      const legacyText = legacyRes.getContentText();
      const legacyJson = JSON.parse(legacyText);

      if (legacyJson.status && legacyJson.status !== 'OK' && legacyJson.status !== 'ZERO_RESULTS') {
        Logger.log(`API Warning for ${shop}: ${legacyJson.status} - ${legacyJson.error_message || ''}`);
      }

      if (legacyJson.results && legacyJson.results.length > 0 && legacyJson.results[0].photos && legacyJson.results[0].photos.length > 0) {
        const photoRef = legacyJson.results[0].photos[0].photo_reference;
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photo_reference=${photoRef}&key=${apiKey}`;
        sheet.getRange(i + 1, photoColIdx + 1).setValue(photoUrl);
        updatedCount++;
        Logger.log(`[Legacy API] Added photo for ${shop}`);
        Utilities.sleep(150);
      } else {
        if (i <= 3) {
          Logger.log(`Sample row ${i} (${shop}) New API result: ${newApiText.substring(0, 200)} | Legacy API result: ${legacyText.substring(0, 200)}`);
        }
      }
    } catch (e) {
      // ถ้าเป็นเรื่องสิทธิ์ (Permission error) ให้โยนออกไป เพื่อให้ Google Apps Script แสดงหน้าต่างขอสิทธิ์ (OAuth Modal)
      if (e.message && (e.message.indexOf('permission') >= 0 || e.message.indexOf('UrlFetchApp') >= 0 || e.message.indexOf('external_request') >= 0)) {
        throw new Error('จำเป็นต้องให้สิทธิ์เข้าถึง (Authorization Required): ' + e.message);
      }
      Logger.log(`Error fetching photo for ${shop}: ${e.message}`);
    }
  }

  Logger.log(`อัปเดตรูปสำเร็จทั้งหมด ${updatedCount} ร้าน`);
  return `Updated ${updatedCount} spots with photos`;
}

// ============================================================================
// ADMIN MENU & SHEET ADJUSTMENT HELPERS
// ============================================================================

/**
 * ฟังก์ชันสำหรับกดเพื่อให้ Google แสดงหน้าต่างขอสิทธิ์เข้าถึง (OAuth Authorization)
 */
function authorizeExternalRequest() {
  UrlFetchApp.fetch('https://www.google.com');
  Logger.log('ได้รับสิทธิ์เชื่อมต่อภายนอกเรียบร้อยแล้ว');
  return 'Authorized successfully!';
}

/**
 * สร้างเมนูด้านบน Google Sheets อัตโนมัติเมื่อเปิดชีต
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('⚡ Fukuoka Explorer')
      .addItem('1. ปรับฟิลด์ Fukuoka_list (Location ⇄ Desc)', 'fixFukuokaSheetColumns')
      .addItem('2. ปรับหัวตาราง Expenses (แก้คอลัมน์เลื่อน)', 'fixExpensesSheetHeader')
      .addItem('3. ให้สิทธิ์เชื่อมต่อภายนอก (Authorize API)', 'authorizeExternalRequest')
      .addToUi();
  } catch (e) {
    Logger.log('Cannot build UI in non-spreadsheet context: ' + e.message);
  }
}

/**
 * ปรับปรุงชื่อฟิลด์ในชีต Fukuoka_list ให้สอดคล้องกับ Data:
 * 1. เปลี่ยน Cell F1 (เดิม Location) เป็น 'Desc'
 * 2. เปลี่ยน Cell G1 (เดิม Desc) เป็น 'Location'
 * 3. ตรวจสอบ Cell A1 ถ้าเป็น 'Hag' ให้แก้เป็น 'Flag'
 * 4. สลับข้อมูลเฉพาะแถวที่มีการใส่สลับ เช่น แถวที่ 10 (Hyotan Sushi) ที่มี 'B2 Solaria Stage' ในช่อง F และ 'สายพาน' ในช่อง G
 *    ให้ 'สายพาน' อยู่ในช่อง Desc (ช่อง F) และ 'B2 Solaria Stage' อยู่ในช่อง Location (ช่อง G)
 */
function fixFukuokaSheetColumns() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName('Fukuoka_list') || ss.getSheetByName(CONFIG.SPOTS_SHEET_NAME) || ss.getSheetByName('PI_Japan_list') || ss.getSheets()[0];
  if (!sheet) {
    Logger.log('ไม่พบชีต Fukuoka_list');
    return 'Sheet not found';
  }

  // 1. ตรวจสอบและแก้ไขหัวตาราง Row 1
  const lastCol = Math.max(sheet.getLastColumn(), 9);
  const headerRange = sheet.getRange(1, 1, 1, lastCol);
  const headers = headerRange.getValues()[0];

  // แก้ไข A1 ถ้าเป็น Hag -> Flag
  if (String(headers[0]).trim().toLowerCase() === 'hag') {
    sheet.getRange(1, 1).setValue('Flag');
  }

  // ปรับหัวตาราง F1 เป็น Desc และ G1 เป็น Location
  sheet.getRange(1, 6).setValue('Desc');
  sheet.getRange(1, 7).setValue('Location');

  // 2. ตรวจสอบและจัดเรียงข้อมูลแถว เช่น Hyotan Sushi (B2 Solaria Stage / สายพาน)
  const data = sheet.getDataRange().getValues();
  let fixedRowsCount = 0;
  for (let i = 1; i < data.length; i++) {
    const valF = String(data[i][5] || '').trim();
    const valG = String(data[i][6] || '').trim();

    // กรณีมีคำว่า B2 Solaria Stage ใน F และ สายพาน ใน G -> สลับให้อยู่ถูกคอลัมน์
    if (valF.includes('B2 Solaria Stage') && valG.includes('สายพาน')) {
      sheet.getRange(i + 1, 6).setValue('สายพาน');
      sheet.getRange(i + 1, 7).setValue('B2 Solaria Stage');
      fixedRowsCount++;
    }
  }

  Logger.log(`ปรับปรุงฟิลด์ Desc และ Location ในชีต ${sheet.getName()} เรียบร้อยแล้ว (สลับข้อมูลแถวพิเศษ ${fixedRowsCount} รายการ)`);
  return `Successfully updated ${sheet.getName()}: Col F is now 'Desc', Col G is now 'Location'.`;
}

