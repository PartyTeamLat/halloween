// Guest list for the Halloween page.
//
// 1. Create a Google Sheet.
// 2. Extensions → Apps Script, replace the default file with this one.
//    Also add a file named qr and paste apps-script/qr.gs into it.
// 3. Run setup once and allow the permissions.
// 4. Fill the Settings sheet: adminPassword, address, paymentInstructions, replyTo.
// 5. Deploy → New deployment → Web app.
//    Execute as: Me
//    Who has access: Anyone
// 6. Copy the web app URL into js/config.js as scriptUrl.
//
// Changing the Settings sheet does not need a new deployment.
// Changing this file does: Deploy → Manage deployments → Edit → New version.

var GUEST_HEADERS = [
  "id",
  "submitted",
  "name",
  "email",
  "phone",
  "partySize",
  "companions",
  "costume",
  "note",
  "status",
  "invitationSent",
  "paid",
  "token",
  "checkedIn",
];

var COL_STATUS = 10;
var COL_SENT = 11;
var COL_PAID = 12;
var COL_TOKEN = 13;
var COL_CHECKED = 14;

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("Halloween")
    .addItem("Set up sheets", "setup")
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();
  var guests = ss.getSheetByName("Guests");
  if (!guests) {
    var first = ss.getSheets()[0];
    if (first.getLastRow() === 0 && (first.getName() === "Sheet1" || first.getName() === "Hoja 1")) {
      first.setName("Guests");
      guests = first;
    } else {
      guests = ss.insertSheet("Guests");
    }
  }
  if (String(guests.getRange(1, 1).getValue()) !== "id") {
    guests.getRange(1, 1, 1, GUEST_HEADERS.length).setValues([GUEST_HEADERS]);
    guests.getRange(1, 1, 1, GUEST_HEADERS.length).setFontWeight("bold");
    guests.setFrozenRows(1);
    guests.getRange("A:N").setNumberFormat("@");
  }

  var settings = ss.getSheetByName("Settings");
  if (!settings) settings = ss.insertSheet("Settings");
  if (String(settings.getRange(1, 1).getValue()) !== "key") {
    var defaults = [
      ["key", "value"],
      ["adminPassword", "change-me"],
      ["partyName", "Halloween"],
      ["dateLabel", "Friday, October 30"],
      ["timeLabel", "9 p.m. to 2 a.m."],
      ["address", "ASOBIBA Tsukuba, second floor, 724 Saiki, Tsukuba, Ibaraki"],
      ["priceLabel", "¥2,000 per person"],
      ["paymentInstructions", "Reply to this email and we will tell you where to send the contribution."],
      ["hostName", "The hosts"],
      ["replyTo", "you@gmail.com"],
    ];
    settings.getRange(1, 1, defaults.length, 2).setValues(defaults);
    settings.getRange(1, 1, 1, 2).setFontWeight("bold");
    settings.setFrozenRows(1);
  }
}

function doGet(e) {
  var payload = {};
  try {
    payload = JSON.parse((e && e.parameter && e.parameter.payload) || "{}");
  } catch (err) {
    return respond({ ok: false, error: "Could not read that request." });
  }
  return respond(handle(payload));
}

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    return respond(handle(payload));
  } catch (err) {
    return respond({ ok: false, error: "Could not read that request." });
  }
}

function respond(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function handle(payload) {
  try {
    if (!payload || !payload.action) return { ok: false, error: "Unknown request." };
    if (payload.action === "register") return registerGuest(payload);
    if (payload.action === "list") return listGuests(payload);
    if (payload.action === "update") return updateGuest(payload);
    if (payload.action === "checkin") return checkInGuest(payload);
    return { ok: false, error: "Unknown request." };
  } catch (err) {
    return { ok: false, error: err.message || "The guest list could not do that." };
  }
}

function registerGuest(payload) {
  if (clean(payload.company, 200)) return { ok: true };
  var name = clean(payload.name, 80);
  var email = clean(payload.email, 120).toLowerCase();
  var phone = clean(payload.phone, 40);
  var companions = clean(payload.companions, 160);
  var costume = clean(payload.costume, 140);
  var note = clean(payload.note, 400);
  var partySize = parseInt(payload.partySize, 10);

  if (name.length < 2) return { ok: false, error: "Add the name you want on the list." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email does not look complete." };
  }
  if (partySize !== 1) {
    return { ok: false, error: "Each person needs their own invitation." };
  }
  if (payload.agreed !== true) {
    return { ok: false, error: "Agree to the rules to request a place." };
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = guestSheet();
    var rows = readGuests(sheet);
    var id = clean(payload.id, 80) || Utilities.getUuid();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i].id === id) return { ok: true, already: true };
      if (String(rows[i].email).toLowerCase() === email && rows[i].status !== "declined") {
        return { ok: false, error: "That email is already on the confirmation list." };
      }
    }
    sheet.appendRow([
      safeCell(id),
      new Date().toISOString(),
      safeCell(name),
      safeCell(email),
      safeCell(phone),
      String(partySize),
      safeCell(partySize > 1 ? companions : ""),
      safeCell(costume),
      safeCell(note),
      "pending",
      "",
      "",
      "",
      "",
    ]);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function listGuests(payload) {
  var settings = requireHost(payload.password);
  var guests = readGuests(guestSheet());
  guests.forEach(function (guest) {
    delete guest.token;
  });
  return {
    ok: true,
    guests: guests,
    mail: mailSummary(settings),
  };
}

function updateGuest(payload) {
  var settings = requireHost(payload.password);
  var id = clean(payload.id, 80);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = guestSheet();
    var found = findGuest(sheet, id);
    if (!found) return { ok: false, error: "That request is no longer on the list." };
    var guest = found.guest;

    if ((payload.resend === true || payload.status === "accepted") && !addressReady(settings)) {
      return {
        ok: false,
        error: "Add the real street address in the Settings sheet before sending an invitation.",
      };
    }

    if (payload.preview === true) {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before copying an invitation." };
      }
      guest.token = ensureToken(sheet, found);
      return {
        ok: true,
        invitationText: invitationBody(guest, settings, true),
        doorCode: doorCodeText(guest.token),
      };
    }

    if (payload.resend === true) {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before sending an invitation." };
      }
      guest.token = ensureToken(sheet, found);
      var resent = sendInvitation(guest, settings);
      sheet.getRange(found.rowNumber, COL_SENT).setValue(resent.sentAt);
      return {
        ok: true,
        warning: resent.warning,
        invitationText: resent.text,
        doorCode: doorCodeText(guest.token),
      };
    }

    var status = clean(payload.status, 20);
    if (status === "accepted") {
      guest.status = "accepted";
      guest.token = ensureToken(sheet, found);
      var sent = sendInvitation(guest, settings);
      sheet.getRange(found.rowNumber, COL_STATUS).setValue("accepted");
      sheet.getRange(found.rowNumber, COL_SENT).setValue(sent.sentAt);
      return {
        ok: true,
        warning: sent.warning,
        invitationText: sent.text,
        doorCode: doorCodeText(guest.token),
      };
    }
    if (status === "declined") {
      sheet.getRange(found.rowNumber, COL_STATUS).setValue("declined");
      sheet.getRange(found.rowNumber, COL_CHECKED).setValue("");
      return { ok: true };
    }
    if (status === "pending") {
      sheet.getRange(found.rowNumber, COL_STATUS).setValue("pending");
      sheet.getRange(found.rowNumber, COL_PAID).setValue("");
      sheet.getRange(found.rowNumber, COL_CHECKED).setValue("");
      return { ok: true };
    }
    if (status === "paid") {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before marking the contribution paid." };
      }
      sheet.getRange(found.rowNumber, COL_PAID).setValue("yes");
      return { ok: true };
    }
    if (status === "arrived") {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before marking them inside." };
      }
      var arrivedAt = new Date().toISOString();
      sheet.getRange(found.rowNumber, COL_CHECKED).setNumberFormat("@").setValue(arrivedAt);
      return { ok: true };
    }
    if (status === "clear-arrival") {
      sheet.getRange(found.rowNumber, COL_CHECKED).setValue("");
      return { ok: true };
    }
    return { ok: false, error: "That update is not one the list understands." };
  } finally {
    lock.releaseLock();
  }
}

function checkInGuest(payload) {
  requireHost(payload.password);
  var token = normalizeDoorCode(payload.token);
  if (!token) return { ok: true, result: "unknown" };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = guestSheet();
    var found = findGuestByToken(sheet, token);
    if (!found) return { ok: true, result: "unknown" };
    var guest = found.guest;
    if (guest.status !== "accepted") {
      return {
        ok: true,
        result: "not-accepted",
        name: guest.name,
        status: guest.status,
      };
    }
    if (guest.checkedIn) {
      return {
        ok: true,
        result: "already",
        name: guest.name,
        email: guest.email,
        paid: guest.paid,
        checkedIn: guest.checkedIn,
      };
    }
    var arrivedAt = new Date().toISOString();
    sheet.getRange(found.rowNumber, COL_CHECKED).setNumberFormat("@").setValue(arrivedAt);
    return {
      ok: true,
      result: "welcome",
      name: guest.name,
      email: guest.email,
      paid: guest.paid,
      checkedIn: arrivedAt,
    };
  } finally {
    lock.releaseLock();
  }
}

function sendInvitation(guest, settings) {
  var picture = null;
  var pictureWarning = "";
  try {
    picture = makeDoorGif(doorCodeText(guest.token));
  } catch (err) {
    pictureWarning =
      "The invitation was sent without the door picture. In Apps Script, add the qr file, deploy a new version, and resend.";
  }
  var text = invitationBody(guest, settings, !!picture);
  var sentAt = new Date().toISOString();
  try {
    var message = {
      to: guest.email,
      subject: "Your invitation — " + (settings.partyName || "Halloween"),
      body: text,
      name: settings.hostName || "The hosts",
    };
    if (picture) {
      var attached = null;
      try {
        attached = picture.copyBlob();
      } catch (ignore) {}
      message.htmlBody = invitationHtml(guest, settings);
      message.inlineImages = { doorcode: picture };
      if (attached) message.attachments = [attached];
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.replyTo || "")) {
      message.replyTo = settings.replyTo;
    }
    MailApp.sendEmail(message);
    return { sentAt: sentAt, text: text, warning: pictureWarning };
  } catch (err) {
    return {
      sentAt: "",
      text: text,
      warning:
        "The place was updated, but the email could not be sent. Use Door code and send the picture yourself.",
    };
  }
}

function addressReady(settings) {
  return settings.address && settings.address.indexOf("Write the street") !== 0;
}

function invitationLines(guest, settings, hasPicture) {
  var lines = [
    "Hello " + guest.name + ",",
    "",
    "You have a place at " + (settings.partyName || "Halloween") + ".",
    "",
    settings.dateLabel || "",
    settings.timeLabel || "",
    settings.address || "",
    "https://maps.app.goo.gl/qSQiDCiEJaP639ev6",
    "",
    "This invitation is for you only.",
    "",
    "The contribution is " + (settings.priceLabel || "") + ".",
    settings.paymentInstructions || "",
    "",
    "Snacks and the soft drink bar are included. The snacks are not a meal, so you may bring food. The bar does not serve alcohol, and you may bring your own drinks.",
    "Costumes are encouraged, not required. There is a costume competition.",
    "We can refuse entry for unruly or disruptive behavior.",
    "",
  ];
  if (hasPicture) {
    lines.push("Show the door-code picture in this email when you arrive. It is for you only.");
    lines.push("");
  }
  lines.push("See you there,");
  lines.push(settings.hostName || "The hosts");
  return lines;
}

function invitationBody(guest, settings, hasPicture) {
  return invitationLines(guest, settings, hasPicture).join("\n");
}

function invitationHtml(guest, settings) {
  var lines = invitationLines(guest, settings, true);
  var html = ['<div style="font-family:Georgia,serif;font-size:16px;line-height:1.45;color:#24120f">'];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (!line) continue;
    if (/^https?:\/\//.test(line)) {
      html.push('<p><a href="' + escapeHtml(line) + '">' + escapeHtml(line) + "</a></p>");
    } else {
      html.push("<p>" + escapeHtml(line) + "</p>");
    }
    if (line.indexOf("Show the door-code picture") === 0) {
      html.push('<p><img src="cid:doorcode" width="260" height="260" alt="Door code"></p>');
    }
  }
  html.push("</div>");
  return html.join("");
}

function ensureToken(sheet, found) {
  if (found.guest.token) return found.guest.token;
  var token = newDoorToken();
  sheet.getRange(found.rowNumber, COL_TOKEN).setNumberFormat("@").setValue(token);
  found.guest.token = token;
  return token;
}

function newDoorToken() {
  var digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + ":" + String(Math.random()) + ":" + String(new Date().getTime())
  );
  var hex = "";
  for (var i = 0; i < 12; i++) {
    var value = digest[i];
    if (value < 0) value += 256;
    var piece = value.toString(16).toUpperCase();
    if (piece.length < 2) piece = "0" + piece;
    hex += piece;
  }
  return hex;
}

function doorCodeText(token) {
  return "LATAM1." + String(token || "").toUpperCase();
}

function normalizeDoorCode(value) {
  var text = clean(value, 80).toUpperCase();
  var match = text.match(/LATAM1\.([0-9A-F]{16,64})/);
  return match ? match[1] : "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function requireHost(password) {
  var settings = getSettings();
  if (!settings.adminPassword || settings.adminPassword === "change-me") {
    throw new Error("Set a real adminPassword in the Settings sheet, then try again.");
  }
  if (password !== settings.adminPassword) throw new Error("That password is wrong.");
  return settings;
}

function mailSummary(settings) {
  return {
    partyName: settings.partyName || "",
    dateLabel: settings.dateLabel || "",
    timeLabel: settings.timeLabel || "",
    priceLabel: settings.priceLabel || "",
    address: settings.address || "",
    paymentInstructions: settings.paymentInstructions || "",
    replyTo: settings.replyTo || "",
    hostName: settings.hostName || "",
    demo: false,
  };
}

function guestSheet() {
  var sheet = SpreadsheetApp.getActive().getSheetByName("Guests");
  if (!sheet) throw new Error("Missing the Guests sheet. Run setup() once in Apps Script.");
  ensureGuestColumns(sheet);
  return sheet;
}

function ensureGuestColumns(sheet) {
  var width = Math.max(sheet.getLastColumn(), GUEST_HEADERS.length);
  var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
  if (String(headers[0]) !== "id") return;
  if (String(headers[12]) === "token" && String(headers[13]) === "checkedIn") return;
  sheet.getRange(1, COL_TOKEN).setValue("token").setFontWeight("bold");
  sheet.getRange(1, COL_CHECKED).setValue("checkedIn").setFontWeight("bold");
  sheet.getRange("M:N").setNumberFormat("@");
}

function getSettings() {
  var sheet = SpreadsheetApp.getActive().getSheetByName("Settings");
  if (!sheet) throw new Error("Missing the Settings sheet. Run setup() once in Apps Script.");
  var values = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < values.length; i++) {
    map[String(values[i][0] || "")] = String(values[i][1] || "");
  }
  return map;
}

function readGuests(sheet) {
  var values = sheet.getDataRange().getValues();
  var guests = [];
  for (var i = 1; i < values.length; i++) {
    if (!values[i][0]) continue;
    guests.push(rowToGuest(values[i]));
  }
  var rank = { pending: 0, accepted: 1, declined: 2 };
  guests.sort(function (a, b) {
    var byStatus = (rank[a.status] || 9) - (rank[b.status] || 9);
    if (byStatus !== 0) return byStatus;
    return String(b.submitted).localeCompare(String(a.submitted));
  });
  return guests;
}

function findGuest(sheet, id) {
  return findGuestWhere(sheet, function (row) {
    return String(row[0]) === id;
  });
}

function findGuestByToken(sheet, token) {
  var wanted = String(token || "").toUpperCase();
  return findGuestWhere(sheet, function (row) {
    return String(row[COL_TOKEN - 1] || "").toUpperCase() === wanted;
  });
}

function findGuestWhere(sheet, match) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (match(values[i])) {
      return { rowNumber: i + 1, guest: rowToGuest(values[i]) };
    }
  }
  return null;
}

function rowToGuest(row) {
  return {
    id: asText(row[0]),
    submitted: asText(row[1]),
    name: asText(row[2]),
    email: asText(row[3]),
    phone: asText(row[4]),
    partySize: parseInt(row[5], 10) || 1,
    companions: asText(row[6]),
    costume: asText(row[7]),
    note: asText(row[8]),
    status: asText(row[9]) || "pending",
    invitationSent: asText(row[10]),
    paid: asText(row[11]),
    token: asText(row[12]).toUpperCase(),
    checkedIn: asText(row[13]),
  };
}

function asText(value) {
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  return String(value || "");
}

function clean(value, max) {
  var text = String(value || "")
    .replace(/[\u0000-\u001F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length > max) text = text.slice(0, max);
  return text;
}

function safeCell(value) {
  var text = String(value || "");
  if (/^[=+\-@]/.test(text)) return "'" + text;
  return text;
}
