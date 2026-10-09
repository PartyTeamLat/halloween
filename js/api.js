(function () {
  var STORAGE_KEY = "halloween-guest-list-v1";

  function party() {
    return window.PARTY || {};
  }

  function isDemo() {
    return !String(party().scriptUrl || "").trim();
  }

  function readLocal() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function writeLocal(guests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(guests));
  }

  function moneyLabel() {
    var amount = Number(party().priceAmount);
    var symbol = party().priceSymbol || "$";
    if (!isFinite(amount)) return party().priceNote || "";
    var shown = amount % 1 === 0 ? Math.round(amount).toLocaleString("en-US") : amount.toFixed(2);
    return symbol + shown + " per person";
  }

  function localInvitation(guest) {
    var lines = [
      "Hello " + guest.name + ",",
      "",
      "You have a place at " + (party().name || "Halloween") + ".",
      "",
      party().dateLabel || "",
      party().timeLabel || "",
      party().placeLabel || "",
      party().placeAddress || "",
      party().placeUrl || "",
      "",
      "This invitation is for you only.",
      "",
      "The contribution is " + moneyLabel() + ".",
      "Payment instructions go here once they are saved in the Google Sheet.",
      "",
      "Snacks and the soft drink bar are included. The snacks are not a meal, so you may bring food. The bar does not serve alcohol, and you may bring your own drinks.",
      "Costumes are encouraged, not required. There is a costume competition.",
      "We can refuse entry for unruly or disruptive behavior.",
      "",
      "Show the door-code picture in the invitation email when you arrive. It is for you only.",
      "",
      "See you there,",
      party().hostLine || "The hosts",
    ];
    return lines.join("\n");
  }

  function localRegister(payload) {
    if (payload.company) return { ok: true };
    if (Number(payload.partySize) > 1) {
      return { ok: false, error: "Each person needs their own invitation." };
    }
    var guests = readLocal();
    var email = String(payload.email || "").toLowerCase();
    var existing = guests.some(function (guest) {
      return (
        String(guest.email || "").toLowerCase() === email &&
        guest.status !== "declined"
      );
    });
    if (existing) {
      return {
        ok: false,
        error: "That email is already on the confirmation list.",
      };
    }
    guests.push({
      id: payload.id,
      submitted: new Date().toISOString(),
      name: payload.name,
      email: payload.email,
      phone: payload.phone || "",
      partySize: Number(payload.partySize) || 1,
      companions: payload.companions || "",
      costume: payload.costume || "",
      note: payload.note || "",
      status: "pending",
      invitationSent: "",
      paid: "",
      token: "",
      checkedIn: "",
    });
    writeLocal(guests);
    return { ok: true };
  }

  function localList() {
    return {
      ok: true,
      guests: readLocal(),
      mail: {
        priceLabel: moneyLabel(),
        address: "",
        paymentInstructions: "",
        replyTo: "",
        partyName: party().name || "Halloween",
        dateLabel: party().dateLabel || "",
        timeLabel: party().timeLabel || "",
        hostName: party().hostLine || "",
        demo: true,
      },
    };
  }

  function localUpdate(payload) {
    var guests = readLocal();
    var guest = null;
    guests.forEach(function (item) {
      if (item.id === payload.id) guest = item;
    });
    if (!guest) return { ok: false, error: "That request is no longer on the list." };

    if (payload.preview === true) {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before copying an invitation." };
      }
      if (!guest.token) guest.token = makeToken();
      writeLocal(guests);
      return {
        ok: true,
        invitationText: localInvitation(guest),
        doorCode: doorCodeText(guest.token),
      };
    }

    if (payload.status === "accepted") {
      guest.status = "accepted";
      guest.invitationSent = new Date().toISOString();
      if (!guest.token) guest.token = makeToken();
    } else if (payload.status === "declined") {
      guest.status = "declined";
      guest.checkedIn = "";
    } else if (payload.status === "pending") {
      guest.status = "pending";
      guest.paid = "";
      guest.checkedIn = "";
    } else if (payload.status === "paid") {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before marking the contribution paid." };
      }
      guest.paid = "yes";
    } else if (payload.status === "arrived") {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before marking them inside." };
      }
      guest.checkedIn = new Date().toISOString();
    } else if (payload.status === "clear-arrival") {
      guest.checkedIn = "";
    } else if (payload.resend) {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before copying an invitation." };
      }
      guest.invitationSent = new Date().toISOString();
      if (!guest.token) guest.token = makeToken();
    }

    writeLocal(guests);
    return {
      ok: true,
      invitationText: localInvitation(guest),
      doorCode: guest.token ? doorCodeText(guest.token) : "",
      guest: guest,
    };
  }

  function localCheckIn(token) {
    var code = normalizeDoorCode(token);
    if (!code) return { ok: true, result: "unknown" };
    var guests = readLocal();
    var guest = null;
    guests.forEach(function (item) {
      if (String(item.token || "").toUpperCase() === code) guest = item;
    });
    if (!guest) return { ok: true, result: "unknown" };
    if (guest.status !== "accepted") {
      return { ok: true, result: "not-accepted", name: guest.name, status: guest.status };
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
    guest.checkedIn = new Date().toISOString();
    writeLocal(guests);
    return {
      ok: true,
      result: "welcome",
      name: guest.name,
      email: guest.email,
      paid: guest.paid,
      checkedIn: guest.checkedIn,
    };
  }

  function makeToken() {
    var bytes = new Uint8Array(12);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(bytes);
    else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var hex = "";
    for (var j = 0; j < bytes.length; j++) {
      var piece = bytes[j].toString(16).toUpperCase();
      hex += piece.length < 2 ? "0" + piece : piece;
    }
    return hex;
  }

  function doorCodeText(token) {
    return "LATAM1." + String(token || "").toUpperCase();
  }

  function normalizeDoorCode(value) {
    var match = String(value || "")
      .toUpperCase()
      .match(/LATAM1\.([0-9A-F]{16,64})/);
    return match ? match[1] : "";
  }

  async function postJson(url, payload) {
    var response = await fetch(url, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    return response.json();
  }

  async function getJson(url, payload) {
    var endpoint = new URL(url);
    endpoint.searchParams.set("payload", JSON.stringify(payload));
    endpoint.searchParams.set("t", String(Date.now()));
    var response = await fetch(endpoint.toString(), {
      method: "GET",
      cache: "no-store",
    });
    return response.json();
  }

  async function call(payload) {
    var url = String(party().scriptUrl || "").trim();
    var data = null;
    try {
      data = await postJson(url, payload);
    } catch (err) {
      data = null;
    }
    var lost =
      !data ||
      data.error === "Unknown request." ||
      typeof data.ok === "undefined";
    if (lost) {
      try {
        data = await getJson(url, payload);
      } catch (err) {
        throw new Error(
          "Could not reach the guest list. Check the script URL and your connection."
        );
      }
    }
    if (!data || data.ok !== true) {
      throw new Error((data && data.error) || "The guest list could not do that.");
    }
    return data;
  }

  function unwrap(result) {
    if (!result || result.ok !== true) {
      throw new Error((result && result.error) || "The guest list could not do that.");
    }
    return result;
  }

  async function register(payload) {
    if (isDemo()) return unwrap(localRegister(payload));
    return call(payload);
  }

  async function list(password) {
    if (isDemo()) {
      if (password !== "demo") throw new Error("That password is wrong.");
      return unwrap(localList());
    }
    return call({ action: "list", password: password });
  }

  async function update(password, payload) {
    var body = Object.assign({ action: "update", password: password }, payload);
    if (isDemo()) {
      if (password !== "demo") throw new Error("That password is wrong.");
      return unwrap(localUpdate(body));
    }
    return call(body);
  }

  async function checkIn(password, token) {
    if (isDemo()) {
      if (password !== "demo") throw new Error("That password is wrong.");
      return unwrap(localCheckIn(token));
    }
    return call({ action: "checkin", password: password, token: token });
  }

  window.GuestList = {
    isDemo: isDemo,
    moneyLabel: moneyLabel,
    register: register,
    list: list,
    update: update,
    checkIn: checkIn,
  };
})();
