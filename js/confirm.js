(function () {
  var params = new URLSearchParams(window.location.search);
  var id = params.get("id") || "";
  var answer = params.get("answer") || "";
  var eyebrow = document.getElementById("confirm-eyebrow");
  var title = document.getElementById("confirm-title");
  var line = document.getElementById("confirm-line");
  var other = document.getElementById("confirm-other");

  function otherLink(current) {
    var next = current === "yes" ? "no" : "yes";
    other.hidden = false;
    other.href = "confirm.html?id=" + encodeURIComponent(id) + "&answer=" + next;
    other.textContent = next === "yes" ? "I'll be there" : "I can't make it";
  }

  if (!id || (answer !== "yes" && answer !== "no")) {
    line.textContent = "Open the link in the reminder email.";
    return;
  }

  window.GuestList.rsvp({ id: id, answer: answer })
    .then(function (result) {
      var name = result.name ? ", " + result.name : "";
      if (result.answer === "no") {
        eyebrow.textContent = "Noted";
        title.textContent = "We'll miss you.";
      } else {
        eyebrow.textContent = "Coming";
        title.textContent = "See you Friday.";
      }
      line.textContent = "That's all" + name + ".";
      otherLink(result.answer);
    })
    .catch(function (err) {
      var message = (err && err.message) || "Could not save that.";
      if (message === "Unknown request.") {
        message = "That answer could not be saved yet. Tell the hosts, and try the link again later.";
      }
      line.textContent = message;
    });
})();
