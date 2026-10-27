(function () {
  var PASSWORD_KEY = "halloween-host-password";
  var party = window.PARTY || {};
  var password = sessionStorage.getItem(PASSWORD_KEY) || "";
  var voters = [];
  var contestants = [];

  function explain(err, fallback) {
    var message = (err && err.message) || "";
    if (message === "Unknown request.") {
      return "The contest is not on the guest list yet. Paste the new Apps Script and deploy a new version.";
    }
    return message || fallback;
  }
  var voteForm = document.getElementById("vote-form");
  var voterSelect = document.getElementById("voter");
  var choiceSelect = document.getElementById("choice");
  var voteError = document.getElementById("vote-error");
  var loadError = document.getElementById("load-error");
  var emptyBallot = document.getElementById("empty-ballot");
  var success = document.getElementById("vote-success");
  var hostLogin = document.getElementById("host-login");
  var hostBoard = document.getElementById("host-board");
  var hostError = document.getElementById("host-error");
  var results = document.getElementById("results");
  var addGuest = document.getElementById("add-guest");

  document.getElementById("contest-title").textContent = party.name || "Halloween";

  function setPassword(value) {
    password = value;
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  }

  function option(value, label) {
    var item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function fillSelect(select, placeholder, items) {
    var current = select.value;
    select.textContent = "";
    select.appendChild(option("", placeholder));
    items.forEach(function (item) {
      select.appendChild(option(item.id, item.name));
    });
    if (current) select.value = current;
  }

  function choicesFor(voterId) {
    return contestants.filter(function (contestant) {
      return contestant.guestId !== voterId;
    });
  }

  function renderBallot() {
    fillSelect(voterSelect, "Choose your name", voters);
    fillSelect(choiceSelect, "Choose a costume", choicesFor(voterSelect.value));
    var open = contestants.length > 0 && voters.length > 0;
    if (success.hidden) voteForm.hidden = !open;
    emptyBallot.hidden = contestants.length > 0 || !success.hidden;
    if (!voters.length && !loadError.textContent) {
      emptyBallot.hidden = false;
      emptyBallot.textContent = "Nobody has been invited yet.";
    }
  }

  function renderHost(state) {
    hostLogin.hidden = true;
    hostBoard.hidden = false;
    document.getElementById("vote-total").textContent =
      (state.totalVotes || 0) + ((state.totalVotes || 0) === 1 ? " vote in" : " votes in");
    results.textContent = "";
    (state.contestants || []).forEach(function (contestant) {
      var card = document.createElement("article");
      card.className = "guest-card";
      var head = document.createElement("div");
      head.className = "guest-head";
      var title = document.createElement("h3");
      title.textContent = contestant.name;
      var count = document.createElement("p");
      count.className = "vote-count";
      count.textContent = String(contestant.votes || 0);
      head.appendChild(title);
      head.appendChild(count);
      var actions = document.createElement("div");
      actions.className = "guest-actions";
      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "button button-quiet";
      remove.textContent = "Remove";
      remove.dataset.remove = contestant.id;
      actions.appendChild(remove);
      card.appendChild(head);
      card.appendChild(actions);
      results.appendChild(card);
    });
    var onBallot = {};
    contestants.forEach(function (contestant) {
      onBallot[contestant.guestId] = true;
    });
    fillSelect(
      addGuest,
      "Choose an invited guest",
      voters.filter(function (voter) {
        return !onBallot[voter.id];
      })
    );
  }

  function showHostLogin() {
    hostLogin.hidden = false;
    hostBoard.hidden = true;
  }

  async function loadPublic() {
    loadError.hidden = true;
    try {
      var state = await window.GuestList.contest("");
      voters = state.voters || [];
      contestants = state.contestants || [];
      renderBallot();
    } catch (err) {
      loadError.hidden = false;
      loadError.textContent = explain(err, "The contest could not be loaded.");
      voteForm.hidden = true;
    }
  }

  async function loadHost() {
    hostError.hidden = true;
    try {
      var state = await window.GuestList.contest(password);
      voters = state.voters || [];
      contestants = state.contestants || [];
      renderBallot();
      renderHost(state);
    } catch (err) {
      setPassword("");
      showHostLogin();
      hostError.hidden = false;
      hostError.textContent = explain(err, "That password is wrong.");
      loadPublic();
    }
  }

  voterSelect.addEventListener("change", function () {
    fillSelect(choiceSelect, "Choose a costume", choicesFor(voterSelect.value));
  });

  voteForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    voteError.hidden = true;
    var button = document.getElementById("vote-button");
    button.disabled = true;
    try {
      var result = await window.GuestList.contestVote({
        voterId: voterSelect.value,
        contestantId: choiceSelect.value,
      });
      voteForm.hidden = true;
      success.hidden = false;
      document.getElementById("vote-line").textContent = result.replaced
        ? "Your vote is now for " + result.name + "."
        : "You voted for " + result.name + ".";
      if (password) loadHost();
    } catch (err) {
      voteError.hidden = false;
      voteError.textContent = explain(err, "Could not save that vote.");
      button.disabled = false;
    }
  });

  document.getElementById("change-vote").addEventListener("click", function () {
    success.hidden = true;
    voteForm.hidden = false;
    document.getElementById("vote-button").disabled = false;
  });

  hostLogin.addEventListener("submit", function (event) {
    event.preventDefault();
    setPassword(document.getElementById("password").value);
    loadHost();
  });

  document.getElementById("add-form").addEventListener("submit", async function (event) {
    event.preventDefault();
    var addError = document.getElementById("add-error");
    addError.hidden = true;
    try {
      var state = await window.GuestList.contestAdd(password, {
        guestId: addGuest.value,
        name: document.getElementById("add-name").value,
      });
      document.getElementById("add-name").value = "";
      voters = state.voters || [];
      contestants = state.contestants || [];
      renderBallot();
      renderHost(state);
    } catch (err) {
      addError.hidden = false;
      addError.textContent = explain(err, "Could not add that contestant.");
    }
  });

  results.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-remove]");
    if (!button) return;
    var contestant = contestants.filter(function (item) {
      return item.id === button.dataset.remove;
    })[0];
    if (!contestant || !window.confirm("Remove " + contestant.name + " from the ballot?")) return;
    try {
      var state = await window.GuestList.contestRemove(password, contestant.id);
      voters = state.voters || [];
      contestants = state.contestants || [];
      renderBallot();
      renderHost(state);
    } catch (err) {
      hostError.hidden = false;
      hostError.textContent = explain(err, "Could not remove that contestant.");
    }
  });

  document.getElementById("host-sign-out").addEventListener("click", function () {
    setPassword("");
    showHostLogin();
    loadPublic();
  });

  if (password) loadHost();
  else loadPublic();
})();
