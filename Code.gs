/**
 * Mahall Management Backend (Google Apps Script)
 * Deployed as a Web App to handle CRUD operations.
 */

const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE'; // Replace with actual Sheet ID
const ss = SpreadsheetApp.getActiveSpreadsheet() || (SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE' ? SpreadsheetApp.openById(SPREADSHEET_ID) : null);

if (!ss) {
  Logger.log('ERROR: Spreadsheet not found. Please check your SPREADSHEET_ID.');
}

/**
 * Handle HTTP GET Requests
 * Query params: 
 * action: string (members, payments, expenses, dashboard, org)
 * org_id: string (required)
 */
function doGet(e) {
  if (!ss) return createResponse({ error: 'Spreadsheet connection failed. Check SPREADSHEET_ID in Code.gs' }, 500);
  const action = e.parameter.action;
  const org_id = e.parameter.org_id;

  if (!org_id && action !== 'super_admin_data') {
    return createResponse({ error: 'Missing org_id' }, 400);
  }

  try {
    switch (action) {
      case 'members':
        return createResponse(getDataByOrgId('members', org_id));
      case 'payments':
        return createResponse(getDataByOrgId('payments', org_id));
      case 'expenses':
        return createResponse(getDataByOrgId('expenses', org_id));
      case 'dashboard':
        return createResponse(getDashboardStats(org_id));
      case 'org':
        return createResponse(getDataById('organization', org_id));
      case 'super_admin_data':
        return createResponse(getSuperAdminData(e.parameter.phone));
      default:
        return createResponse({ error: 'Invalid action' }, 404);
    }
  } catch (err) {
    return createResponse({ error: err.message }, 500);
  }
}

/**
 * Handle HTTP POST Requests
 * Body params: 
 * action: string (login, addMember, editMember, deleteMember, addPayment, addExpense, updateOrg)
 * data: object
 */
function doPost(e) {
  if (!ss) return createResponse({ error: 'Spreadsheet connection failed. Check SPREADSHEET_ID in Code.gs' }, 500);
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  const data = body.data;

  // 1. Check Expiry for all mutation actions
  const mutationActions = ['addMember', 'editMember', 'deleteMember', 'addPayment', 'editPayment', 'deletePayment', 'addExpense', 'editExpense', 'deleteExpense', 'updateOrg'];
  if (mutationActions.includes(action)) {
    let orgIdToChecked = data.org_id;
    if (!orgIdToChecked && data.id) {
       // Search in respective sheets to find the org_id
       if (action.includes('Member')) orgIdToChecked = (getDataById('members', data.id) || {}).org_id;
       else if (action.includes('Payment')) orgIdToChecked = (getDataById('payments', data.id) || {}).org_id;
       else if (action.includes('Expense')) orgIdToChecked = (getDataById('expenses', data.id) || {}).org_id;
       else if (action === 'updateOrg') orgIdToChecked = data.id;
    }
    
    if (orgIdToChecked && isOrgExpired(orgIdToChecked)) {
       return createResponse({ success: false, error: 'Subscription expired. Please renew your plan to perform this action.' });
    }
  }

  try {
    switch (action) {
      case 'login':
        return handleLogin(data);
      case 'register':
        return handleRegister(data);
      case 'addMember':
        return addRecord('members', data);
      case 'editMember':
        return updateRecord('members', data);
      case 'deleteMember':
        return handleDeleteMember(data);
      case 'addPayment':
        return addRecord('payments', data);
      case 'editPayment':
        return updateRecord('payments', data);
      case 'deletePayment':
        return deleteRecord('payments', data.id);
      case 'addExpense':
        return addRecord('expenses', data);
      case 'editExpense':
        return updateRecord('expenses', data);
      case 'deleteExpense':
        return deleteRecord('expenses', data.id);
      case 'updateOrg':
        return updateRecord('organization', data);
      case 'updateUserPlan':
        return updateUserPlan(data);
      default:
        return createResponse({ error: 'Invalid action' }, 404);
    }
  } catch (err) {
    return createResponse({ error: err.message }, 500);
  }
}

// --- CORE LOGIC ---

function getDataByOrgId(sheetName, org_id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data
    .filter(row => row[1] == org_id) // Assuming org_id is always second column (index 1)
    .map(row => {
      let obj = {};
      headers.forEach((header, i) => obj[header] = row[i]);
      return obj;
    });
}

function getSuperAdminData(phone) {
  if (phone != '7994295190') return { error: 'Unauthorized' };
  
  const orgs = getAllRecords('organization');
  const users = getAllRecords('users');
  
  return {
    organizations: orgs.map(org => {
      const admin = users.find(u => u.id === org.admin_id) || {};
      return {
        ...org,
        admin_name: admin.name,
        admin_phone: admin.phone,
        plan_expiry: admin.plan_expiry
      };
    })
  };
}

function getAllRecords(sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    let obj = {};
    headers.forEach((header, i) => obj[header] = row[i]);
    return obj;
  });
}

function updateUserPlan(data) {
  const { admin_phone, plan_type, plan_expiry, org_id } = data;
  
  // 1. Update Org Plan Type
  const orgSheet = ss.getSheetByName('organization');
  const orgValues = orgSheet.getDataRange().getValues();
  const orgRowIndex = orgValues.findIndex(r => r[0] == org_id);
  if (orgRowIndex !== -1) {
    const headers = orgValues[0];
    const typeIdx = headers.indexOf('plan_type');
    if (typeIdx !== -1) {
      orgSheet.getRange(orgRowIndex + 1, typeIdx + 1).setValue(plan_type);
    }
  }

  // 2. Update Admin Expiry
  const userSheet = ss.getSheetByName('users');
  const userValues = userSheet.getDataRange().getValues();
  const userRowIndex = userValues.findIndex(r => r[2] == admin_phone);
  if (userRowIndex !== -1) {
    const headers = userValues[0];
    const expiryIdx = headers.indexOf('plan_expiry');
    if (expiryIdx !== -1) {
      userSheet.getRange(userRowIndex + 1, expiryIdx + 1).setValue(formatDateDDMMYYYY(plan_expiry));
    }
  }

  return createResponse({ success: true });
}

function formatDateDDMMYYYY(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function parseDateDDMMYYYY(str) {
  if (!str) return new Date(0);
  if (str instanceof Date) return str;
  const parts = str.toString().split('-');
  if (parts.length === 3) {
    return new Date(parts[2], parts[1] - 1, parts[0]);
  }
  return new Date(str);
}

function getDataById(sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const row = data.find(r => r[0] == id);
  
  if (!row) return { error: 'Not found' };
  
  let obj = {};
  headers.forEach((header, i) => obj[header] = row[i]);
  return obj;
}

function handleLogin(data) {
  const { phone, password } = data;
  const sheet = ss.getSheetByName('users');
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();
  
  const userRow = values.find(row => row[2] == phone); // Phone at index 2
  
  if (userRow && userRow[3] == password) { // Directly compare the client-side hash with the stored hash
    let user = {};
    headers.forEach((header, i) => user[header] = userRow[i]);
    
    // Super Admin flag
    user.isSuperAdmin = (user.phone == '7994295190');
    
    // Final check for expiry if they are not Super Admin
    if (!user.isSuperAdmin) {
      const expiryDate = parseDateDDMMYYYY(user.plan_expiry);
      user.isExpired = (new Date()) > expiryDate;
    } else {
      user.isExpired = false; // Super Admin never expires
    }
    
    delete user.password; // Don't send hash back
    return createResponse({ success: true, user });
  }
  
  return createResponse({ success: false, error: 'Invalid credentials' });
}

function isOrgExpired(org_id) {
  const org = getDataById('organization', org_id);
  if (!org || !org.admin_id) return false;
  
  const admin = getDataById('users', org.admin_id);
  if (!admin || admin.phone == '7994295190') return false; // Super Admin bypasses expiry
  
  const expiryDate = parseDateDDMMYYYY(admin.plan_expiry);
  return (new Date()) > expiryDate;
}

function handleDeleteMember(data) {
  const memberId = data.id;
  // 1. Cascade delete all payments belonging to this member
  const paymentSheet = ss.getSheetByName('payments');
  const values = paymentSheet.getDataRange().getValues();
  const headers = values[0];
  const memberIdIdx = headers.indexOf('member_id');
  
  if (memberIdIdx !== -1) {
    // Traverse backwards when deleting rows
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][memberIdIdx] == memberId) {
        paymentSheet.deleteRow(i + 1);
      }
    }
  }

  // 2. Finally delete the member record
  return deleteRecord('members', memberId);
}

function handleRegister(data) {
  const { name, phone, password, place } = data;
  const userSheet = ss.getSheetByName('users');
  const orgSheet = ss.getSheetByName('organization');
  
  if (!orgSheet) return createResponse({ success: false, error: 'Sheet "organization" not found.' });
  if (!userSheet) return createResponse({ success: false, error: 'Sheet "users" not found.' });

  // 1. Check if user exists
  const userValues = userSheet.getDataRange().getValues();
  const phoneExists = userValues.some(row => row[2] == phone);
  if (phoneExists) return createResponse({ success: false, error: 'Phone number already registered' });
  
  // 2. Create Organization
  const orgId = Utilities.getUuid();
  const adminId = Utilities.getUuid();
  const now = new Date();
  
  const orgData = {
    id: orgId,
    name: name + ' Mahall',
    place: place,
    created_at: now.toISOString(),
    plan_type: 'Trial',
    admin_id: adminId
  };
  
  // Append to org
  const orgLastCol = orgSheet.getLastColumn();
  if (orgLastCol === 0) return createResponse({ success: false, error: 'Sheet "organization" is empty. Add headers first.' });
  const orgHeaders = orgSheet.getRange(1, 1, 1, orgLastCol).getValues()[0];
  orgSheet.appendRow(orgHeaders.map(h => orgData[h] || ''));
  
  // 3. Create Admin User
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30); // 30 day trial
  
  const userData = {
    id: adminId,
    name: name,
    phone: phone,
    password: password, // Already hashed from client
    org_id: orgId,
    role: 'admin',
    plan_expiry: formatDateDDMMYYYY(expiryDate)
  };
  
  const userLastCol = userSheet.getLastColumn();
  if (userLastCol === 0) return createResponse({ success: false, error: 'Sheet "users" is empty. Add headers first.' });
  const userHeaders = userSheet.getRange(1, 1, 1, userLastCol).getValues()[0];
  userSheet.appendRow(userHeaders.map(h => userData[h] || ''));
  
  return createResponse({ success: true, message: 'Registration successful' });
}

function getDashboardStats(org_id) {
  const allMembers = getDataByOrgId('members', org_id);
  const activeMembersCount = allMembers.filter(m => m.status === 'active').length;
  
  const allPayments = getDataByOrgId('payments', org_id);
  const allExpenses = getDataByOrgId('expenses', org_id);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const currentMonthPayments = allPayments.filter(p => {
    if (!p.date) return false;
    const d = new Date(p.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const currentMonthExpenses = allExpenses.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalPayments = currentMonthPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalExpenses = currentMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    totalMembers: activeMembersCount,
    totalPayments: totalPayments,
    totalExpenses: totalExpenses,
    balance: totalPayments - totalExpenses,
    recentPayments: currentMonthPayments.slice(-5).reverse(), // Last 5
    recentExpenses: currentMonthExpenses.slice(-5).reverse()
  };
}

function addRecord(sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // Auto ID if missing
  if (!data.id) data.id = Utilities.getUuid();
  
  const rowValues = headers.map(h => data[h] || '');
  sheet.appendRow(rowValues);
  
  return createResponse({ success: true, data });
}

function updateRecord(sheetName, data) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(r => r[0] == data.id);
  
  if (rowIndex === -1) return createResponse({ error: 'Record not found' }, 404);
  
  const headers = values[0];
  const rowValues = headers.map(h => data[h] !== undefined ? data[h] : values[rowIndex][headers.indexOf(h)]);
  
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([rowValues]);
  
  return createResponse({ success: true });
}

function deleteRecord(sheetName, id) {
  const sheet = ss.getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const rowIndex = values.findIndex(r => r[0] == id);
  
  if (rowIndex === -1) return createResponse({ error: 'Record not found' }, 404);
  
  sheet.deleteRow(rowIndex + 1);
  return createResponse({ success: true });
}

// --- UTILS ---

function compareHash(plain, hash) {
  // Simple check for demonstration; in production use proper SHA256 bytes comparison
  // For this App, we assume hash is passed from client or generated here
  const hashedInput = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, plain)
    .map(val => (val < 0 ? val + 256 : val).toString(16).padStart(2, '0'))
    .join('');
  return hashedInput === hash;
}

function createResponse(data, code = 200) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
