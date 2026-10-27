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
  ensureContestSheets();
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
    if (payload.action === "contest") return contestState(payload);
    if (payload.action === "contestVote") return contestVote(payload);
    if (payload.action === "contestAdd") return contestAdd(payload);
    if (payload.action === "contestRemove") return contestRemove(payload);
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
  var isNote = payload.kind === "note";

  if (name.length < 2) return { ok: false, error: "Add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "That email does not look complete." };
  }
  if (!isNote && partySize !== 1) {
    return { ok: false, error: "Each person needs their own invitation." };
  }
  if (isNote && note.length < 2) {
    return { ok: false, error: "Write a note or a question." };
  }
  if (payload.agreed !== true) {
    return {
      ok: false,
      error: isNote
        ? "Confirm that you understand the planned space is full."
        : "Agree to the commandments to request a place.",
    };
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
        return {
          ok: false,
          error: rows[i].status === "note"
            ? "We already have a note from that email."
            : "That email is already on the confirmation list.",
        };
      }
    }
    sheet.appendRow([
      safeCell(id),
      new Date().toISOString(),
      safeCell(name),
      safeCell(email),
      safeCell(phone),
      "1",
      "",
      safeCell(costume),
      safeCell(note),
      isNote ? "note" : "pending",
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
    "This invitation is just for you.",
    "",
    "The contribution is " + (settings.priceLabel || "") + ".",
    settings.paymentInstructions || "",
    "",
    "Soft drinks included. Bring your own if you want alcohol. Snacks, not a meal.",
    "Dress up if you like. A costume is welcome, not required, and there is a competition.",
    "If someone is unruly or spoiling the night, we can ask them to leave.",
    "",
  ];
  if (hasPicture) {
    lines.push("When you arrive, show the door-code picture in this email. It's just for you.");
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
    if (line.indexOf("door-code picture") !== -1) {
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
  var rank = { pending: 0, note: 1, accepted: 2, declined: 3 };
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

function ensureContestSheets() {
  sheetWithHeaders("Contestants", ["id", "guestId", "name", "added"]);
  sheetWithHeaders("Votes", ["voterId", "contestantId", "updated"]);
}

function sheetWithHeaders(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (String(sheet.getRange(1, 1).getValue()) !== headers[0]) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  sheet.getRange(1, 1, Math.max(sheet.getMaxRows(), 2), headers.length).setNumberFormat("@");
  return sheet;
}

function contestantSheet() {
  ensureContestSheets();
  return SpreadsheetApp.getActive().getSheetByName("Contestants");
}

function voteSheet() {
  ensureContestSheets();
  return SpreadsheetApp.getActive().getSheetByName("Votes");
}

function readContestants() {
  return readRows(contestantSheet(), function (row) {
    if (!row[0]) return null;
    return { id: asText(row[0]), guestId: asText(row[1]), name: asText(row[2]), added: asText(row[3]) };
  });
}

function readVotes() {
  return readRows(voteSheet(), function (row) {
    if (!row[0]) return null;
    return { voterId: asText(row[0]), contestantId: asText(row[1]), updated: asText(row[2]) };
  });
}

function readRows(sheet, map) {
  var values = sheet.getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var item = map(values[i]);
    if (item) rows.push(item);
  }
  return rows;
}

function acceptedGuests() {
  return readGuests(guestSheet()).filter(function (guest) {
    return guest.status === "accepted";
  });
}

function voterChoices(guests) {
  var counts = {};
  guests.forEach(function (guest) {
    var name = guest.name || "Guest";
    counts[name] = (counts[name] || 0) + 1;
  });
  var seen = {};
  return guests
    .map(function (guest) {
      var name = guest.name || "Guest";
      var label = name;
      if (counts[name] > 1) {
        seen[name] = (seen[name] || 0) + 1;
        var mail = String(guest.email || "").split("@")[0];
        label = name + (mail ? " · " + mail : " (" + seen[name] + ")");
      }
      return { id: guest.id, name: label, plain: name };
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
}

function contestState(payload) {
  var host = false;
  if (payload.password) {
    requireHost(payload.password);
    host = true;
  }
  var contestants = readContestants();
  var votes = host ? readVotes() : [];
  var counts = {};
  votes.forEach(function (vote) {
    counts[vote.contestantId] = (counts[vote.contestantId] || 0) + 1;
  });
  return {
    ok: true,
    voters: voterChoices(acceptedGuests()).map(function (voter) {
      return { id: voter.id, name: voter.name };
    }),
    contestants: contestants
      .map(function (contestant) {
        var item = { id: contestant.id, guestId: contestant.guestId, name: contestant.name };
        if (host) item.votes = counts[contestant.id] || 0;
        return item;
      })
      .sort(function (a, b) {
        if (host && b.votes !== a.votes) return b.votes - a.votes;
        return a.name.localeCompare(b.name);
      }),
    totalVotes: host ? votes.length : 0,
  };
}

function contestAdd(payload) {
  requireHost(payload.password);
  var guestId = clean(payload.guestId, 80);
  var found = findGuest(guestSheet(), guestId);
  if (!found || found.guest.status !== "accepted") {
    return { ok: false, error: "Choose someone who was invited." };
  }
  var name = clean(payload.name, 80) || found.guest.name;
  if (name.length < 2) return { ok: false, error: "Add the name that should appear on the ballot." };
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var contestants = readContestants();
    for (var i = 0; i < contestants.length; i++) {
      if (contestants[i].guestId === guestId) {
        return { ok: false, error: "That person is already on the ballot." };
      }
    }
    contestantSheet().appendRow([Utilities.getUuid(), guestId, safeCell(name), new Date().toISOString()]);
    return contestState(payload);
  } finally {
    lock.releaseLock();
  }
}

function contestRemove(payload) {
  requireHost(payload.password);
  var id = clean(payload.id, 80);
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    deleteRowsWhere(contestantSheet(), 0, id);
    deleteRowsWhere(voteSheet(), 1, id);
    return contestState(payload);
  } finally {
    lock.releaseLock();
  }
}

function contestVote(payload) {
  var voterId = clean(payload.voterId, 80);
  var contestantId = clean(payload.contestantId, 80);
  var found = findGuest(guestSheet(), voterId);
  if (!found || found.guest.status !== "accepted") {
    return { ok: false, error: "Pick your name from the invited guests." };
  }
  var contestants = readContestants();
  var contestant = null;
  for (var i = 0; i < contestants.length; i++) {
    if (contestants[i].id === contestantId) contestant = contestants[i];
  }
  if (!contestant) return { ok: false, error: "That person is no longer on the ballot." };
  if (contestant.guestId === found.guest.id) return { ok: false, error: "Vote for someone else." };

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = voteSheet();
    var values = sheet.getDataRange().getValues();
    var rowNumber = 0;
    for (var r = 1; r < values.length; r++) {
      if (String(values[r][0]) === voterId) rowNumber = r + 1;
    }
    if (rowNumber) {
      sheet.getRange(rowNumber, 2, 1, 2).setValues([[contestantId, new Date().toISOString()]]);
    } else {
      sheet.appendRow([voterId, contestantId, new Date().toISOString()]);
    }
    return { ok: true, name: contestant.name, replaced: rowNumber > 0 };
  } finally {
    lock.releaseLock();
  }
}

function deleteRowsWhere(sheet, column, value) {
  var values = sheet.getDataRange().getValues();
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][column]) === value) sheet.deleteRow(i + 1);
  }
}
