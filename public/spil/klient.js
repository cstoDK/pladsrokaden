// Spillepladen-klienten: lader et spil sende point til tavlen.
//
// Brug i et spil på samme adresse som Spillepladen:
//   <script src="klient.js"></script>
//   Spillepladen.sendResultat("Counter-Norm", rigtige, muligeIAlt)
//
// Eleven skal først have meldt sig på elevsiden (kode, plads og figur) i
// samme fane. Har eleven ikke det, gør klienten ingenting, og spillet virker
// som før. Der sendes kun plads, en tilfældig enheds-id og point. Aldrig navne.
(function () {
  "use strict";
  var DATABASE = "https://spillepladen-984b5-default-rtdb.europe-west1.firebasedatabase.app";
  var NOEGLE = "spillepladen.elev.v1";
  var KODE = /^[A-HJKMNP-Z2-9]{4}$/;
  var PLADS = /^[A-Za-z0-9_-]{1,64}#\d{1,3}$/;

  function mig() {
    try {
      var m = JSON.parse(sessionStorage.getItem(NOEGLE) || "null");
      if (m && KODE.test(m.kode) && typeof m.enhed === "string" && PLADS.test(m.plads || "") && m.figur) return m;
    } catch (e) {}
    return null;
  }

  function tilfaeldigId() {
    var a = new Uint8Array(8);
    crypto.getRandomValues(a);
    return "r" + Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
  }

  /** Sender et resultat. Giver et løfte, der bliver true, når tavlen har fået det. */
  function sendResultat(spil, point, maks) {
    var m = mig();
    if (!m || !(maks > 0)) return Promise.resolve(false);
    var besked = { t: "resultat", id: tilfaeldigId(), enhed: m.enhed, plads: m.plads, spil: String(spil).slice(0, 40), point: Number(point) || 0, maks: Number(maks) };
    return fetch(DATABASE + "/rum/" + m.kode + "/beskeder.json", {
      method: "POST",
      body: JSON.stringify(JSON.stringify(besked)),
      referrerPolicy: "no-referrer",
    }).then(function (r) { return r.ok; }, function () { return false; });
  }

  window.Spillepladen = { mig: mig, sendResultat: sendResultat };
})();
