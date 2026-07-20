const API_ESTOQUE = document.currentScript.dataset.api;
const TEM_COMPOSICAO = API_ESTOQUE === "produtos";

const colEstoque = db.collection(API_ESTOQUE);
let itensCache = {};
let itemEditando = null;
let materiaPrimaCache = [];

if (TEM_COMPOSICAO) {
  db.collection("materiaprima").orderBy("nome").onSnapshot(snap => {
    materiaPrimaCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

colEstoque.orderBy("nome").onSnapshot(snap => {
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(itens);
});

document.getElementById("form").addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const campos = Array.from(document.getElementById("form").querySelectorAll("input, select"))
    .filter(el => !el.disabled && el.offsetParent !== null);
  const idx = campos.indexOf(document.activeElement);
  if (idx > -1 && idx < campos.length - 1) campos[idx + 1].focus();
});

function criarLinhaComposicao(item) {
  const opcoes = materiaPrimaCache.map(mp =>
    `<option value="${mp.id}">${escHtml(mp.nome)} (${escHtml(mp.ud || "-")})</option>`
  ).join("");

  const linha = document.createElement("div");
  linha.className = "form-item-row";
  linha.innerHTML = `
    <select class="comp-materiaprima">${opcoes}</select>
    <input type="number" step="any" min="0" class="comp-qtd" value="${item ? item.quantidade : 1}" />
    <button type="button" class="btn-remove-item" onclick="removerComposicaoItem(this)">✕</button>
  `;
  if (item) linha.querySelector(".comp-materiaprima").value = item.materiaprima_id;
  return linha;
}

function adicionarComposicaoItem(item) {
  if (materiaPrimaCache.length === 0) {
    alert("Cadastre matérias-primas antes de montar a composição.");
    return;
  }
  document.getElementById("composicao-container").appendChild(criarLinhaComposicao(item));
}

function removerComposicaoItem(botao) {
  botao.closest(".form-item-row").remove();
}

function render(itens) {
  const lista = document.getElementById("lista");
  itensCache = {};

  if (itens.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhum item cadastrado</div>';
    return;
  }

  lista.innerHTML = itens.map(i => {
    itensCache[i.id] = i;
    return `
      <div class="card" style="cursor:pointer" onclick="mostrarDetalhes('${i.id}')">
        <div class="card-acoes">
          <button class="btn-edit" onclick="event.stopPropagation(); abrirFormulario('${i.id}')">✏️</button>
          <button class="btn-del" onclick="event.stopPropagation(); excluirItem('${i.id}')">🗑️</button>
        </div>
        <div class="card-nome">${escHtml(i.nome)}</div>
        <div class="card-meta">
          <span>UD: ${escHtml(i.ud || "-")}</span>
          <span>Valor: ${fmtMoeda(i.valor)}</span>
          <span>Estoque: ${i.estoque}</span>
          ${TEM_COMPOSICAO ? `<span>Peso: ${Number(i.peso || 0)} kg</span>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function mostrarDetalhes(id) {
  const i = itensCache[id];
  if (!i) return;

  let composicaoHtml = "";
  let valorHtml = `<div class="detalhe-linha">Valor: ${fmtMoeda(i.valor)}</div>`;

  if (TEM_COMPOSICAO) {
    const itensComp = i.composicao || [];
    const precoCusto = itensComp.reduce((soma, c) => {
      const mp = materiaPrimaCache.find(m => m.id === c.materiaprima_id);
      return soma + (mp ? Number(mp.valor || 0) * Number(c.quantidade || 0) : 0);
    }, 0);

    valorHtml = `
      <div class="detalhe-linha">Preço de custo: ${fmtMoeda(precoCusto)}</div>
      <div class="detalhe-linha">Preço de venda: ${fmtMoeda(i.valor)}</div>
    `;

    composicaoHtml = `
      <div class="detalhe-secao">Composição</div>
      ${itensComp.length === 0
        ? '<div class="detalhe-linha">Nenhuma matéria-prima</div>'
        : itensComp.map(c => `<div class="detalhe-linha">${escHtml(c.materiaprima_nome)} — ${c.quantidade} ${escHtml(c.ud || "")}</div>`).join("")}
    `;
  }

  const overlay = document.createElement("div");
  overlay.className = "choice-overlay";
  overlay.innerHTML = `
    <div class="choice-box detalhe-box">
      <div class="choice-titulo">${escHtml(i.nome)}</div>
      <div class="detalhe-linha">UD: ${escHtml(i.ud || "-")}</div>
      ${valorHtml}
      <div class="detalhe-linha">Estoque: ${i.estoque}</div>
      ${TEM_COMPOSICAO ? `<div class="detalhe-linha">Peso unitário: ${Number(i.peso || 0)} kg</div>` : ""}
      ${composicaoHtml}
      <button type="button" class="btn-choice" id="btn-fechar-detalhe">Fechar</button>
    </div>
  `;
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector("#btn-fechar-detalhe").addEventListener("click", () => overlay.remove());
  document.body.appendChild(overlay);
}

function abrirFormulario(id) {
  itemEditando = id || null;

  if (itemEditando) {
    const i = itensCache[itemEditando];
    document.getElementById("f-nome").value = i.nome || "";
    document.getElementById("f-ud").value = i.ud || "";
    document.getElementById("f-valor").value = String(i.valor ?? 0).replace(".", ",");
    document.getElementById("f-estoque").value = i.estoque ?? 0;
    if (document.getElementById("f-peso")) document.getElementById("f-peso").value = i.peso ?? 0;
  } else {
    document.getElementById("form").reset();
  }

  if (TEM_COMPOSICAO) {
    const container = document.getElementById("composicao-container");
    container.innerHTML = "";
    if (itemEditando) {
      (itensCache[itemEditando].composicao || []).forEach(item => {
        container.appendChild(criarLinhaComposicao(item));
      });
    }
  }

  document.getElementById("form-overlay").style.display = "flex";
}

function fecharFormulario() {
  document.getElementById("form-overlay").style.display = "none";
}

async function salvarItem() {
  const nome = document.getElementById("f-nome").value.trim();
  if (!nome) { alert("Informe o nome"); return; }

  const payload = {
    nome,
    ud: document.getElementById("f-ud").value.trim(),
    valor: parseMoeda(document.getElementById("f-valor").value),
    estoque: parseFloat(document.getElementById("f-estoque").value) || 0
  };

  if (document.getElementById("f-peso")) {
    payload.peso = parseFloat(document.getElementById("f-peso").value) || 0;
  }

  if (TEM_COMPOSICAO) {
    payload.composicao = [];
    document.querySelectorAll("#composicao-container .form-item-row").forEach(linha => {
      const materiaprimaId = linha.querySelector(".comp-materiaprima").value;
      const quantidade = parseFloat(linha.querySelector(".comp-qtd").value) || 0;
      if (materiaprimaId && quantidade > 0) {
        const mp = materiaPrimaCache.find(m => m.id === materiaprimaId);
        payload.composicao.push({
          materiaprima_id: materiaprimaId,
          materiaprima_nome: mp ? mp.nome : "",
          ud: mp ? mp.ud : null,
          quantidade
        });
      }
    });
  }

  if (itemEditando) {
    await colEstoque.doc(itemEditando).update(payload);
  } else {
    payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    await colEstoque.add(payload);
  }

  fecharFormulario();
}

async function excluirItem(id) {
  if (!confirm("Excluir este item?")) return;
  await colEstoque.doc(id).delete();
}
