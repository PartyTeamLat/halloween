(function () {
  var PASSWORD_KEY = "halloween-host-password";
  var party = window.PARTY || {};
  var password = sessionStorage.getItem(PASSWORD_KEY) || "";
  var stream = null;
  var paused = false;
  var lastPayload = "";
  var ignoreUntil = 0;
  var frameTimer = 0;

  var gate = document.getElementById("gate");
  var booth = document.getElementById("booth");
  var video = document.getElementById("camera");
  var canvas = document.getElementById("frame");
  var context = canvas.getContext("2d", { willReadFrequently: true });
  var result = document.getElementById("result");
  var scanStatus = document.getElementById("scan-status");
  var cameraError = document.getElementById("camera-error");
  var openButton = document.getElementById("open-camera");

  document.getElementById("door-title").textContent = party.name || "Halloween";

  function setPassword(value) {
    password = value;
    if (value) sessionStorage.setItem(PASSWORD_KEY, value);
    else sessionStorage.removeItem(PASSWORD_KEY);
  }

  function showBooth() {
    gate.hidden = true;
    booth.hidden = false;
  }

  function showGate() {
    gate.hidden = false;
    booth.hidden = true;
    stopCamera();
  }

  function stopCamera() {
    if (frameTimer) cancelAnimationFrame(frameTimer);
    frameTimer = 0;
    if (stream) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
      stream = null;
    }
    video.hidden = true;
    openButton.hidden = false;
  }

  function beep(ok) {
    try {
      var audio = new (window.AudioContext || window.webkitAudioContext)();
      var osc = audio.createOscillator();
      var gain = audio.createGain();
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.value = 0.06;
      osc.connect(gain);
      gain.connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.12);
    } catch (err) {}
  }

  function formatWhen(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }

  function paidLine(paid) {
    return paid === "yes" ? "Contribution is marked paid." : "Contribution is not marked paid.";
  }

  function showResult(kind, kicker, name, detail, okSound) {
    paused = true;
    result.hidden = false;
    result.className = "scan-result scan-" + kind;
    document.getElementById("result-kicker").textContent = kicker;
    document.getElementById("result-name").textContent = name || "No name";
    document.getElementById("result-detail").textContent = detail || "";
    scanStatus.textContent = "";
    beep(okSound);
  }

  function normalize(raw) {
    var match = String(raw || "")
      .toUpperCase()
      .match(/LATAM1\.[0-9A-F]{16,64}/);
    return match ? match[0] : "";
  }

  async function onCode(raw) {
    if (paused) return;
    var payload = normalize(raw);
    if (!payload) {
      scanStatus.textContent = "That picture is not a door code.";
      return;
    }
    if (payload === lastPayload && Date.now() < ignoreUntil) return;
    paused = true;
    lastPayload = payload;
    scanStatus.textContent = "Checking…";
    try {
      var answer = await window.GuestList.checkIn(password, payload);
      if (answer.result === "welcome") {
        showResult("welcome", "Inside", answer.name, paidLine(answer.paid), true);
      } else if (answer.result === "already") {
        var when = formatWhen(answer.checkedIn);
        showResult(
          "already",
          "Already inside",
          answer.name,
          (when ? "Came in at " + when + ". " : "") + paidLine(answer.paid),
          false
        );
      } else if (answer.result === "not-accepted") {
        showResult("bad", "Not invited", answer.name, "This request was not accepted.", false);
      } else {
        showResult("bad", "Not on the list", "", "This code does not match an invitation.", false);
      }
    } catch (err) {
      var message = err.message || "Could not check that code.";
      if (/password/i.test(message)) {
        setPassword("");
        showGate();
        return;
      }
      showResult("bad", "Try again", "", message, false);
    }
  }

  function tick() {
    frameTimer = requestAnimationFrame(tick);
    if (paused || video.readyState < 2 || !video.videoWidth) return;
    var width = video.videoWidth;
    var height = video.videoHeight;
    var longest = Math.max(width, height);
    var scale = longest > 720 ? 720 / longest : 1;
    var w = Math.floor(width * scale);
    var h = Math.floor(height * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    context.drawImage(video, 0, 0, w, h);
    var image = context.getImageData(0, 0, w, h);
    var code = window.jsQR(image.data, w, h, { inversionAttempts: "dontInvert" });
    if (code && code.data) onCode(code.data);
  }

  async function openCamera() {
    cameraError.hidden = true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      cameraError.hidden = false;
      cameraError.textContent = "This browser cannot open the camera. Use the phone's browser on the live page.";
      return;
    }
    if (typeof window.jsQR !== "function") {
      cameraError.hidden = false;
      cameraError.textContent = "The scanner did not load. Refresh the page.";
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      video.srcObject = stream;
      video.hidden = false;
      openButton.hidden = true;
      await video.play();
      tick();
    } catch (err) {
      cameraError.hidden = false;
      cameraError.textContent = "The camera stayed closed. Allow camera access and try again.";
    }
  }

  document.getElementById("login-form").addEventListener("submit", function (event) {
    event.preventDefault();
    var loginError = document.getElementById("login-error");
    loginError.hidden = true;
    var entered = document.getElementById("password").value;
    setPassword(entered);
    window.GuestList.list(entered)
      .then(function () {
        showBooth();
      })
      .catch(function (err) {
        setPassword("");
        loginError.hidden = false;
        loginError.textContent = err.message || "Could not open the door.";
      });
  });

  openButton.addEventListener("click", openCamera);

  document.getElementById("next").addEventListener("click", function () {
    result.hidden = true;
    scanStatus.textContent = "Point the camera at the picture in their invitation.";
    ignoreUntil = Date.now() + 2500;
    paused = false;
  });

  document.getElementById("sign-out").addEventListener("click", function () {
    setPassword("");
    showGate();
  });

  if (password) {
    window.GuestList.list(password)
      .then(showBooth)
      .catch(function () {
        setPassword("");
      });
  }
})();
