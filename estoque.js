const API_ESTOQUE = document.currentScript.dataset.api;
const TEM_PACOTE = API_ESTOQUE === "materiaprima";
const TEM_COMPOSICAO = API_ESTOQUE === "produtos";

const colEstoque = db.collection(API_ESTOQUE);
let itensCache = {};
let itemEditando = null;
let materiaPrimaCache = [];

if (TEM_PACOTE) {
  document.getElementById("f-pacote").addEventListener("input", recalcularValor);
  document.getElementById("f-peso-pacote").addEventListener("input", recalcularValor);
  document.getElementById("f-preco-pacote").addEventListener("input", recalcularValor);
  document.getElementById("f-ud").addEventListener("change", () => {
    atualizarCamposPacote();
    recalcularValor();
  });
}

if (TEM_COMPOSICAO) {
  db.collection("materiaprima").orderBy("nome").onSnapshot(snap => {
    materiaPrimaCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}

colEstoque.orderBy("nome").onSnapshot(snap => {
  const itens = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(itens);
});

function atualizarCamposPacote() {
  const ud = document.getElementById("f-ud").value;
  document.getElementById("grupo-peso-pacote").style.display = ud === "Ud" ? "none" : "";
}

function recalcularValor() {
  const ud = document.getElementById("f-ud").value;
  const pacote = parseFloat(document.getElementById("f-pacote").value) || 0;
  const peso = parseFloat(document.getElementById("f-peso-pacote").value) || 0;
  const preco = parseMoeda(document.getElementById("f-preco-pacote").value);
  const divisor = ud === "Ud" ? pacote : peso;
  const valor = divisor > 0 ? preco / divisor : 0;
  document.getElementById("f-valor").value = valor.toFixed(2).replace(".", ",");
}

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
      <div class="card">
        <div class="card-acoes">
          <button class="btn-edit" onclick="abrirFormulario('${i.id}')">✏️</button>
          <button class="btn-del" onclick="excluirItem('${i.id}')">🗑️</button>
        </div>
        <div class="card-nome">${escHtml(i.nome)}</div>
        <div class="card-meta">
          <span>UD: ${escHtml(i.ud || "-")}</span>
          <span>Valor: ${fmtMoeda(i.valor)}</span>
          <span>Estoque: ${i.estoque}</span>
        </div>
      </div>
    `;
  }).join("");
}

function abrirFormulario(id) {
  itemEditando = id || null;

  if (itemEditando) {
    const i = itensCache[itemEditando];
    document.getElementById("f-nome").value = i.nome || "";
    document.getElementById("f-ud").value = i.ud || "";
    document.getElementById("f-valor").value = String(i.valor ?? 0).replace(".", ",");
    document.getElementById("f-estoque").value = i.estoque ?? 0;
    if (TEM_PACOTE) {
      document.getElementById("f-pacote").value = i.pacote ?? "";
      document.getElementById("f-peso-pacote").value = i.peso_pacote ?? "";
      document.getElementById("f-preco-pacote").value = String(i.preco_pacote ?? 0).replace(".", ",");
    }
  } else {
    document.getElementById("form").reset();
  }

  if (TEM_PACOTE) atualizarCamposPacote();

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

  if (TEM_PACOTE) {
    payload.pacote = parseFloat(document.getElementById("f-pacote").value) || null;
    payload.peso_pacote = parseFloat(document.getElementById("f-peso-pacote").value) || null;
    payload.preco_pacote = parseMoeda(document.getElementById("f-preco-pacote").value);
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

  let pagamento = null;
  if (TEM_PACOTE && !itemEditando && payload.preco_pacote > 0) {
    pagamento = await perguntarEscolha("Pagamento da compra", [
      { label: "À vista", value: "avista" },
      { label: "A pagar", value: "apagar" }
    ]);
  }

  if (itemEditando) {
    await colEstoque.doc(itemEditando).update(payload);
  } else {
    payload.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
    const docRef = await colEstoque.add(payload);

    if (TEM_PACOTE && payload.preco_pacote > 0) {
      const batch = db.batch();
      if (pagamento === "avista") {
        const lancRef = db.collection("caixaLancamentos").doc();
        batch.set(lancRef, {
          data: hoje(),
          descricao: `Compra: ${nome}`,
          tipo: "saida",
          valor: payload.preco_pacote,
          origem: "materiaprima",
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else if (pagamento === "apagar") {
        const pagarRef = db.collection("contasPagar").doc();
        batch.set(pagarRef, {
          materiaprima_id: docRef.id,
          descricao: `Compra: ${nome}`,
          valor: payload.preco_pacote,
          status: "Pendente",
          criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      await batch.commit();
    }
  }

  fecharFormulario();
}

async function excluirItem(id) {
  if (!confirm("Excluir este item?")) return;
  await colEstoque.doc(id).delete();
}
