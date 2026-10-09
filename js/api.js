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

    if (payload.status === "accepted") {
      guest.status = "accepted";
      guest.invitationSent = new Date().toISOString();
    } else if (payload.status === "declined") {
      guest.status = "declined";
    } else if (payload.status === "pending") {
      guest.status = "pending";
      guest.paid = "";
    } else if (payload.status === "paid") {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before marking the contribution paid." };
      }
      guest.paid = "yes";
    } else if (payload.resend) {
      if (guest.status !== "accepted") {
        return { ok: false, error: "Accept them before copying an invitation." };
      }
      guest.invitationSent = new Date().toISOString();
    }

    writeLocal(guests);
    return { ok: true, invitationText: localInvitation(guest), guest: guest };
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

  window.GuestList = {
    isDemo: isDemo,
    moneyLabel: moneyLabel,
    register: register,
    list: list,
    update: update,
  };
})();
