(function () {
  var PASSWORD_KEY = "halloween-host-password";
  var party = window.PARTY || {};
  var password = sessionStorage.getItem(PASSWORD_KEY) || "";
  var guests = [];
  var mail = null;
  var filter = "pending";

  var gate = document.getElementById("gate");
  var board = document.getElementById("board");
  var loginForm = document.getElementById("login-form");
  var loginError = document.getElementById("login-error");
  var listError = document.getElementById("list-error");
  var guestList = document.getElementById("guest-list");
  var empty = document.getElementById("empty-list");
  var demoNote = document.getElementById("demo-note");

  document.getElementById("admin-title").textContent = party.name || "Halloween";

  if (window.GuestList.isDemo()) {
    demoNote.hidden = false;
    demoNote.textContent =
      "Preview list on this browser. The password is demo. Connect the Google Sheet before you share the page.";
  }

  function setPassword(value) {
    password = value;
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  }

  function formatWhen(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || "";
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function counts() {
    return guests.reduce(
      function (total, guest) {
        var size = Number(guest.partySize) || 1;
        if (guest.status === "pending") {
          total.pending += 1;
          total.asking += size;
        } else if (guest.status === "accepted") {
          total.accepted += size;
          if (guest.paid === "yes") total.paid += size;
          if (guest.checkedIn) total.inside += 1;
        } else if (guest.status === "declined") {
          total.declined += 1;
        }
        return total;
      },
      { pending: 0, asking: 0, accepted: 0, paid: 0, declined: 0, inside: 0 }
    );
  }

  function visibleGuests() {
    return guests.filter(function (guest) {
      if (filter === "all") return true;
      if (filter === "paid") return guest.status === "accepted" && guest.paid === "yes";
      if (filter === "inside") return guest.status === "accepted" && !!guest.checkedIn;
      if (filter === "accepted") return guest.status === "accepted";
      return guest.status === filter;
    });
  }

  function renderStats() {
    var total = counts();
    var capacity = Number(party.capacity);
    var summary = document.getElementById("stats");
    summary.textContent =
      total.accepted +
      " places confirmed · " +
      total.inside +
      " inside · " +
      total.asking +
      " still asking · " +
      total.paid +
      " marked paid";
    var meter = document.getElementById("meter");
    if (!capacity) {
      meter.hidden = true;
      return;
    }
    meter.hidden = false;
    var ratio = Math.min(total.accepted / capacity, 1);
    document.getElementById("meter-fill").style.width = ratio * 100 + "%";
    var label = document.getElementById("meter-label");
    label.textContent = total.accepted + " of " + capacity + " comfortable places confirmed";
    meter.classList.toggle("over", total.accepted > capacity);
  }

  function renderMail() {
    var node = document.getElementById("mail-preview");
    if (!mail || mail.demo) {
      node.hidden = false;
      node.textContent =
        "The page shows " +
        window.GuestList.moneyLabel() +
        ". Invitation emails start working after the Google Sheet is connected.";
      return;
    }
    node.hidden = false;
    var ready = mail.address && mail.address.indexOf("Write the street") !== 0;
    node.textContent = ready
      ? "Invitation email: " +
        mail.partyName +
        " · " +
        mail.dateLabel +
        " · " +
        mail.priceLabel +
        " · " +
        mail.address +
        ". Accepting someone also sends their door code."
      : "Add the real street address in the Settings sheet before you accept anyone.";
  }

  function button(label, className, action, id) {
    var control = document.createElement("button");
    control.type = "button";
    control.className = className;
    control.textContent = label;
    control.dataset.action = action;
    control.dataset.id = id;
    return control;
  }

  function addLine(parent, label, value) {
    if (!value) return;
    var row = document.createElement("p");
    var strong = document.createElement("strong");
    strong.textContent = label + " ";
    row.appendChild(strong);
    row.appendChild(document.createTextNode(value));
    parent.appendChild(row);
  }

  function renderList() {
    guestList.textContent = "";
    var shown = visibleGuests();
    empty.hidden = shown.length !== 0;
    shown.forEach(function (guest) {
      var card = document.createElement("article");
      card.className = "guest-card";

      var head = document.createElement("div");
      head.className = "guest-head";
      var title = document.createElement("h3");
      title.textContent = guest.name || "Unnamed";
      var pill = document.createElement("span");
      var pillState = guest.checkedIn ? "inside" : guest.paid === "yes" ? "paid" : guest.status || "pending";
      pill.className = "pill pill-" + (pillState === "paid" ? "accepted" : pillState);
      pill.textContent = pillState;
      head.appendChild(title);
      head.appendChild(pill);

      var body = document.createElement("div");
      body.className = "guest-body";
      addLine(body, "Email", guest.email);
      addLine(body, "Phone", guest.phone);
      addLine(
        body,
        "Group",
        (guest.partySize || 1) +
          (Number(guest.partySize) > 1 ? " people" : " person")
      );
      addLine(body, "With them", guest.companions);
      addLine(body, "Costume", guest.costume);
      addLine(body, "Note", guest.note);
      addLine(body, "Requested", formatWhen(guest.submitted));
      if (guest.invitationSent) {
        addLine(body, "Invitation", formatWhen(guest.invitationSent));
      }
      if (guest.status === "accepted") {
        addLine(body, "Paid", guest.paid === "yes" ? "Yes" : "Not yet");
      }
      if (guest.checkedIn) addLine(body, "Inside", formatWhen(guest.checkedIn));

      var actions = document.createElement("div");
      actions.className = "guest-actions";
      if (guest.status === "pending") {
        actions.appendChild(
          button(
            window.GuestList.isDemo() ? "Accept" : "Accept and email",
            "button",
            "accepted",
            guest.id
          )
        );
        actions.appendChild(button("Decline", "button button-quiet", "declined", guest.id));
      } else if (guest.status === "accepted") {
        if (guest.paid !== "yes") {
          actions.appendChild(button("Mark paid", "button", "paid", guest.id));
        }
        actions.appendChild(button("Copy invitation", "button button-quiet", "copy", guest.id));
        actions.appendChild(button("Door code", "button button-quiet", "code", guest.id));
        if (!guest.checkedIn) {
          actions.appendChild(button("Mark inside", "button button-quiet", "arrived", guest.id));
        } else {
          actions.appendChild(button("Clear arrival", "button button-quiet", "clear-arrival", guest.id));
        }
        if (!window.GuestList.isDemo()) {
          actions.appendChild(button("Resend email", "button button-quiet", "resend", guest.id));
        }
        actions.appendChild(button("Decline", "button button-quiet", "declined", guest.id));
      } else {
        actions.appendChild(button("Restore", "button button-quiet", "pending", guest.id));
      }

      card.appendChild(head);
      card.appendChild(body);
      card.appendChild(actions);
      guestList.appendChild(card);
    });
  }

  function render() {
    renderStats();
    renderMail();
    renderList();
  }

  async function load() {
    listError.hidden = true;
    guestList.textContent = "Loading the list";
    try {
      var result = await window.GuestList.list(password);
      guests = result.guests || [];
      mail = result.mail || null;
      render();
    } catch (err) {
      guestList.textContent = "";
      listError.hidden = false;
      listError.textContent = err.message || "Could not load the list.";
      if (/password/i.test(listError.textContent)) {
        setPassword("");
        showGate();
      }
    }
  }

  function showBoard() {
    gate.hidden = true;
    board.hidden = false;
    load();
  }

  function showGate() {
    gate.hidden = false;
    board.hidden = true;
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault();
    loginError.hidden = true;
    var entered = document.getElementById("password").value;
    setPassword(entered);
    window.GuestList
      .list(entered)
      .then(function (result) {
        guests = result.guests || [];
        mail = result.mail || null;
        showBoard();
        render();
      })
      .catch(function (err) {
        setPassword("");
        loginError.hidden = false;
        loginError.textContent = err.message || "Could not open the list.";
      });
  });

  document.getElementById("sign-out").addEventListener("click", function () {
    setPassword("");
    showGate();
  });

  document.getElementById("code-close").addEventListener("click", function () {
    document.getElementById("code-panel").hidden = true;
  });

  document.getElementById("refresh").addEventListener("click", load);

  document.getElementById("filters").addEventListener("click", function (event) {
    var target = event.target.closest("[data-filter]");
    if (!target) return;
    filter = target.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach(function (item) {
      item.classList.toggle("is-selected", item.dataset.filter === filter);
    });
    renderList();
  });

  function findGuest(id) {
    return guests.filter(function (guest) {
      return guest.id === id;
    })[0];
  }

  function showDoorCode(name, doorCode) {
    var panel = document.getElementById("code-panel");
    var image = document.getElementById("code-image");
    document.getElementById("code-name").textContent = name || "";
    panel.hidden = false;
    try {
      var drawn = qrcode(0, "Q");
      drawn.addData(doorCode, "Alphanumeric");
      drawn.make();
      image.src = drawn.createDataURL(8);
      image.hidden = false;
    } catch (err) {
      image.removeAttribute("src");
      image.hidden = true;
    }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      window.prompt("Copy this invitation:", text);
    }
  }

  guestList.addEventListener("click", async function (event) {
    var target = event.target.closest("[data-action]");
    if (!target) return;
    var id = target.dataset.id;
    var action = target.dataset.action;
    var guest = findGuest(id);
    if (!guest) return;

    if (action === "copy" || action === "code") {
      target.disabled = true;
      try {
        var preview = await window.GuestList.update(password, { id: id, resend: false, preview: true });
        if (action === "copy") {
          await copyText(preview.invitationText || "");
          target.textContent = "Copied";
        } else if (preview.doorCode) {
          showDoorCode(guest.name, preview.doorCode);
        } else {
          listError.hidden = false;
          listError.textContent = "There is no door code yet. Update the Apps Script, deploy a new version, and try again.";
        }
      } catch (err) {
        listError.hidden = false;
        listError.textContent = err.message || "Could not open that invitation.";
      }
      target.disabled = false;
      return;
    }

    var acceptPrompt = window.GuestList.isDemo()
      ? "Accept " + guest.name + "? You can open their door code afterward. Email starts once the Google Sheet is connected."
      : "Accept " + guest.name + " and email the invitation, with their door code, to " + guest.email + "?";
    var prompts = {
      accepted: acceptPrompt,
      declined: "Decline " + guest.name + "?",
      paid: "Mark the contribution paid for " + guest.name + "?",
      resend: "Email the invitation and door code to " + guest.email + " again?",
      pending: "Move " + guest.name + " back to the confirmation list?",
      arrived: "Mark " + guest.name + " inside without scanning a door code?",
      "clear-arrival": "Clear the arrival for " + guest.name + " so their code can be scanned again?",
    };
    if (!window.confirm(prompts[action])) return;

    target.disabled = true;
    listError.hidden = true;
    try {
      var payload = { id: id };
      if (action === "resend") payload.resend = true;
      else payload.status = action;
      var result = await window.GuestList.update(password, payload);
      if (result.warning) {
        listError.hidden = false;
        listError.textContent = result.warning;
        if (result.invitationText) await copyText(result.invitationText);
      }
      if (result.warning && result.doorCode) showDoorCode(guest.name, result.doorCode);
      await load();
    } catch (err) {
      listError.hidden = false;
      listError.textContent = err.message || "Could not update that guest.";
      target.disabled = false;
    }
  });

  document.getElementById("download").addEventListener("click", function () {
    var header = [
      "status",
      "paid",
      "name",
      "email",
      "phone",
      "partySize",
      "companions",
      "costume",
      "note",
      "submitted",
      "invitationSent",
      "checkedIn",
    ];
    var lines = [header.join(",")];
    guests.forEach(function (guest) {
      lines.push(
        header
          .map(function (key) {
            var cell = String(guest[key] == null ? "" : guest[key]);
            return '"' + cell.replace(/"/g, '""') + '"';
          })
          .join(",")
      );
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "halloween-guest-list.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  if (password) showBoard();
})();
