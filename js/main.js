(function () {
  var party = window.PARTY;
  if (!party) return;

  var formStarted = Date.now();

  function fillText(id, value) {
    var node = document.getElementById(id);
    if (node) node.textContent = value || "";
  }

  function money(amount) {
    var symbol = party.priceSymbol || "$";
    var number = Number(amount);
    if (!isFinite(number)) return "";
    var shown = number % 1 === 0 ? Math.round(number).toLocaleString("en-US") : number.toFixed(2);
    return symbol + shown;
  }

  fillText("host-line", party.hostLine);
  fillText("party-name", party.name);
  fillText("lede", party.lede);
  fillText("price-amount", money(party.priceAmount));
  fillText("price-note", party.priceNote);
  fillText("payment-public", party.paymentPublic);
  var capacityNote = document.getElementById("capacity-note");
  if (party.capacityNote) capacityNote.textContent = party.capacityNote;
  else capacityNote.hidden = true;
  document.title = (party.name || "Halloween") + " — request a place";

  var facts = document.getElementById("facts");
  [
    { label: "When", value: party.dateLabel },
    { label: "Time", value: party.timeLabel },
    { label: "Where", value: party.placeLabel, href: party.placeUrl, detail: party.placeAddress },
  ].forEach(function (fact) {
    var item = document.createElement("li");
    var label = document.createElement("span");
    label.textContent = fact.label;
    var value = document.createElement(fact.href ? "a" : "strong");
    value.textContent = fact.value || "";
    if (fact.href) {
      value.href = fact.href;
      value.target = "_blank";
      value.rel = "noopener noreferrer";
    }
    item.appendChild(label);
    item.appendChild(value);
    if (fact.detail) {
      var detail = document.createElement("span");
      detail.className = "fact-address";
      detail.textContent = fact.detail;
      item.appendChild(detail);
    }
    facts.appendChild(item);
  });

  var offerings = document.getElementById("offerings");
  (party.offerings || []).forEach(function (offer, index) {
    var article = document.createElement("article");
    article.className = "offer";
    var numeral = document.createElement("span");
    numeral.className = "offer-index";
    numeral.textContent = String(index + 1).padStart(2, "0");
    var copy = document.createElement("div");
    var title = document.createElement("h3");
    title.textContent = offer.title || "";
    var text = document.createElement("p");
    text.textContent = offer.text || "";
    copy.appendChild(title);
    copy.appendChild(text);
    article.appendChild(numeral);
    article.appendChild(copy);
    offerings.appendChild(article);
  });

  var rules = document.getElementById("rules");
  (party.rules || []).forEach(function (rule) {
    var item = document.createElement("li");
    item.textContent = rule;
    rules.appendChild(item);
  });

  var banner = document.getElementById("demo-banner");
  if (window.GuestList.isDemo()) {
    banner.hidden = false;
    banner.textContent =
      "Preview on this browser only. Requests stay on this computer until you connect the Google Sheet from the readme.";
  }

  var form = document.getElementById("request-form");
  var estimate = document.getElementById("estimate");
  var error = document.getElementById("form-error");
  var success = document.getElementById("success");
  var submitButton = document.getElementById("submit-request");
  var each = Number(party.priceAmount);
  estimate.textContent = isFinite(each)
    ? "If we accept you, the contribution is " + money(each) + "."
    : "Each person requests their own place.";

  function createId() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "id-" + Date.now().toString(16) + "-" + Math.random().toString(16).slice(2);
  }

  function showError(message) {
    error.hidden = false;
    error.textContent = message;
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    error.hidden = true;
    if (Date.now() - formStarted < 2500) {
      showError("Take a moment to read the commandments, then send it again.");
      return;
    }
    if (!form.reportValidity()) return;

    var data = new FormData(form);
    var payload = {
      action: "register",
      id: createId(),
      name: String(data.get("name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone: "",
      partySize: 1,
      companions: "",
      costume: "",
      note: String(data.get("note") || "").trim(),
      agreed: data.get("agreed") === "yes",
      company: String(data.get("company") || "").trim(),
    };

    submitButton.disabled = true;
    submitButton.textContent = "Sending";
    try {
      await window.GuestList.register(payload);
      form.hidden = true;
      success.hidden = false;
      document.getElementById("success-email").textContent = payload.email;
      document.getElementById("success-price").textContent = window.GuestList.moneyLabel();
      success.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (err) {
      showError(err.message || "Could not send that request.");
      submitButton.disabled = false;
      submitButton.textContent = "Request a place";
    }
  });
})();
