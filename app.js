const VERSAO_IBIRA = "1.39";

const firebaseConfig = {
  apiKey: "AIzaSyB9zO5MO-lVAr6gea4t1pUuG-sC-s7stks",
  authDomain: "sistema-ibira.firebaseapp.com",
  projectId: "sistema-ibira",
  storageBucket: "sistema-ibira.firebasestorage.app",
  messagingSenderId: "88681777707",
  appId: "1:88681777707:web:c13c1e0594756e988ff86e"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("versao-app");
  if (el) el.textContent = "v" + VERSAO_IBIRA;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).catch(() => {});
  });
  navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload());
}

function escHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtMoeda(v) {
  return "R$ " + Number(v || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function parseMoeda(s) {
  const v = parseFloat(String(s ?? "").replace(/[^\d,.-]/g, "").replace(",", "."));
  return isNaN(v) ? 0 : v;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDataSimples(data) {
  if (!data) return "";
  if (data.toDate) data = data.toDate().toISOString();
  const [ano, mes, dia] = String(data).substring(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

function perguntarEscolha(titulo, opcoes) {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "choice-overlay";
    overlay.innerHTML = `
      <div class="choice-box">
        <div class="choice-titulo">${escHtml(titulo)}</div>
        <div class="choice-botoes">
          ${opcoes.map((o, i) => `<button type="button" class="btn-choice${i > 0 ? " secundario" : ""}" data-i="${i}">${escHtml(o.label)}</button>`).join("")}
        </div>
      </div>
    `;
    overlay.querySelectorAll(".btn-choice").forEach(btn => {
      btn.addEventListener("click", () => {
        const opcao = opcoes[Number(btn.dataset.i)];
        overlay.remove();
        resolve(opcao.value);
      });
    });
    document.body.appendChild(overlay);
  });
}
