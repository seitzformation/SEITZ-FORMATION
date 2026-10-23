/* Assistant en ligne SEITZ FORMATION.
   Aucun cookie, aucun stockage navigateur. Rien n'est envoyé tant que le visiteur n'écrit pas un message. */
(function () {
  "use strict";

  var ENDPOINT = "https://seitz-chatbot.thomas-seitz14.workers.dev/";
  var MAX_CHARS = 800;
  var MAX_USER_MESSAGES = 20;
  var WELCOME =
    "Bonjour, je réponds aux questions sur les formations de Thomas Seitz : filières, programmes, zone d'intervention, disponibilités. " +
    "Pour un devis, Thomas répond lui-même par e-mail. Ce site ne conserve pas la conversation ; ne saisissez pas de données personnelles.";

  var css = [
    "#sf-chat-btn{position:fixed;right:20px;bottom:20px;z-index:50;display:flex;align-items:center;gap:8px;padding:12px 18px;border:0;border-radius:999px;background:#f2b705;color:#0b1f33;font:600 15px/1 'IBM Plex Sans',sans-serif;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)}",
    "#sf-chat-btn:hover{background:#ffc928}",
    "#sf-chat-btn:focus-visible,#sf-chat-send:focus-visible,#sf-chat-close:focus-visible,#sf-chat-input:focus-visible{outline:2px solid #f4f2e9;outline-offset:2px}",
    "#sf-chat{position:fixed;right:20px;bottom:20px;z-index:51;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 40px));display:none;flex-direction:column;background:#122c47;color:#f4f2e9;border:1px solid rgba(226,232,240,.18);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);font-family:'IBM Plex Sans',sans-serif;overflow:hidden}",
    "#sf-chat.open{display:flex}",
    "#sf-chat-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:#0b1f33;border-bottom:1px solid rgba(226,232,240,.12)}",
    "#sf-chat-head strong{font-size:15px;font-weight:600}",
    "#sf-chat-head span{display:block;font-size:12px;color:#a9bccd;font-weight:400}",
    "#sf-chat-close{background:none;border:0;color:#f4f2e9;font-size:22px;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px}",
    "#sf-chat-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}",
    ".sf-m{max-width:88%;padding:9px 12px;border-radius:12px;font-size:14.5px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}",
    ".sf-m a{color:#f2b705;text-decoration:underline}",
    ".sf-bot{align-self:flex-start;background:#0b1f33;border:1px solid rgba(226,232,240,.1)}",
    ".sf-user{align-self:flex-end;background:#f2b705;color:#0b1f33}",
    ".sf-wait{color:#a9bccd;font-style:italic}",
    "#sf-chat-form{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(226,232,240,.12);background:#0b1f33}",
    "#sf-chat-input{flex:1;resize:none;height:42px;max-height:100px;padding:10px 12px;border-radius:10px;border:1px solid rgba(226,232,240,.25);background:#122c47;color:#f4f2e9;font:14.5px/1.4 'IBM Plex Sans',sans-serif}",
    "#sf-chat-input::placeholder{color:#a9bccd}",
    "#sf-chat-send{padding:0 16px;border:0;border-radius:10px;background:#f2b705;color:#0b1f33;font:600 14px 'IBM Plex Sans',sans-serif;cursor:pointer}",
    "#sf-chat-send:disabled{opacity:.5;cursor:default}",
    "@media (max-width:480px){#sf-chat{right:12px;left:12px;bottom:12px;width:auto;height:min(75vh,560px)}#sf-chat-btn{right:12px;bottom:12px}}"
  ].join("\n");

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  var btn = document.createElement("button");
  btn.id = "sf-chat-btn";
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "dialog");
  btn.textContent = "Une question ?";

  var box = document.createElement("div");
  box.id = "sf-chat";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-label", "Assistant en ligne SEITZ FORMATION");
  box.innerHTML =
    '<div id="sf-chat-head"><strong>Assistant SEITZ FORMATION<span>Réponses automatiques, sans engagement</span></strong>' +
    '<button id="sf-chat-close" type="button" aria-label="Fermer">×</button></div>' +
    '<div id="sf-chat-msgs" aria-live="polite"></div>' +
    '<form id="sf-chat-form"><textarea id="sf-chat-input" rows="1" maxlength="' + MAX_CHARS + '" placeholder="Votre question…" aria-label="Votre question"></textarea>' +
    '<button id="sf-chat-send" type="submit">Envoyer</button></form>';

  document.body.appendChild(btn);
  document.body.appendChild(box);

  var msgs = box.querySelector("#sf-chat-msgs");
  var form = box.querySelector("#sf-chat-form");
  var input = box.querySelector("#sf-chat-input");
  var send = box.querySelector("#sf-chat-send");
  var history = [];
  var userCount = 0;
  var busy = false;

  // Texte sûr : seuls les liens https et les adresses e-mail deviennent cliquables.
  function render(el, text) {
    var re = /(https:\/\/[^\s)]+|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) el.appendChild(document.createTextNode(text.slice(last, m.index)));
      var raw = m[0].replace(/[.,;:!?]+$/, "");
      var a = document.createElement("a");
      a.textContent = raw;
      a.href = raw.indexOf("@") > -1 && raw.indexOf("https://") !== 0 ? "mailto:" + raw : raw;
      if (a.href.indexOf("https://") === 0) { a.target = "_blank"; a.rel = "noopener"; }
      el.appendChild(a);
      last = m.index + raw.length;
      re.lastIndex = last;
    }
    if (last < text.length) el.appendChild(document.createTextNode(text.slice(last)));
  }

  function add(role, text, cls) {
    var d = document.createElement("div");
    d.className = "sf-m " + (role === "user" ? "sf-user" : "sf-bot") + (cls ? " " + cls : "");
    if (role === "user") d.textContent = text; else render(d, text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function open() {
    box.classList.add("open");
    btn.style.display = "none";
    if (!msgs.children.length) add("bot", WELCOME);
    input.focus();
  }
  function close() {
    box.classList.remove("open");
    btn.style.display = "flex";
    btn.focus();
  }

  btn.addEventListener("click", open);
  box.querySelector("#sf-chat-close").addEventListener("click", close);
  box.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    if (userCount >= MAX_USER_MESSAGES) {
      add("bot", "Pour aller plus loin, écrivez directement à contact@seitzformation.fr : Thomas répond lui-même.");
      return;
    }
    input.value = "";
    add("user", text);
    history.push({ role: "user", content: text });
    userCount++;
    busy = true;
    send.disabled = true;
    var wait = add("bot", "…", "sf-wait");

    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 30000);

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history.slice(-12) }),
      signal: ctrl.signal
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        var reply = res.ok && res.j.reply ? res.j.reply : (res.j && res.j.error) || "Je n'ai pas pu répondre. Vous pouvez écrire à contact@seitzformation.fr.";
        wait.remove();
        add("bot", reply);
        if (res.ok && res.j.reply) history.push({ role: "assistant", content: reply });
        else history.pop();
      })
      .catch(function () {
        wait.remove();
        add("bot", "Service momentanément indisponible. Vous pouvez écrire à contact@seitzformation.fr.");
        history.pop();
      })
      .finally(function () {
        clearTimeout(timer);
        busy = false;
        send.disabled = false;
        input.focus();
      });
  });
})();
