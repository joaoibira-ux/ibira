const colRomaneios = db.collection("romaneios");
const colPedidosRom = db.collection("pedidos");
let romaneiosList = [];
let pedidosList = [];
let romaneioAtualId = null;

colRomaneios.orderBy("criadoEm", "desc").onSnapshot(snap => {
  romaneiosList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  atualizarTelas();
});

colPedidosRom.orderBy("criadoEm", "desc").onSnapshot(snap => {
  pedidosList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  atualizarTelas();
});

function atualizarTelas() {
  renderLista();
  if (romaneioAtualId) renderDetalhe();
  if (document.getElementById("selecao-overlay").style.display !== "none") renderSelecao();
}

function fmtPeso(kg) {
  return Number(kg || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kg";
}

function calcularTotais(pedidos) {
  let valor = 0, peso = 0, qtdItens = 0;
  pedidos.forEach(p => {
    valor += Number(p.total || 0);
    (p.itens || []).forEach(i => {
      qtdItens += Number(i.quantidade || 0);
      peso += Number(i.peso_unitario || 0) * Number(i.quantidade || 0);
    });
  });
  return { valor, peso, qtdItens, totalPedidos: pedidos.length };
}

function pedidosDoRomaneio(id) {
  return pedidosList.filter(p => p.romaneio_id === id);
}

function renderLista() {
  const lista = document.getElementById("lista");

  if (romaneiosList.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhum romaneio cadastrado</div>';
    return;
  }

  lista.innerHTML = romaneiosList.map(r => {
    const t = calcularTotais(pedidosDoRomaneio(r.id));
    return `
      <div class="card" style="cursor:pointer" onclick="abrirDetalhe('${r.id}')">
        <div class="card-acoes">
          <button class="btn-del" onclick="event.stopPropagation(); excluirRomaneio('${r.id}')">🗑️</button>
        </div>
        <div class="card-nome">${escHtml(r.veiculo)}</div>
        <div class="card-meta">
          <span>${fmtDataSimples(r.data)}</span>
          <span>${t.totalPedidos} pedido(s)</span>
        </div>
        <div class="card-meta">
          <span>Itens: ${t.qtdItens}</span>
          <span>${fmtMoeda(t.valor)}</span>
          <span>${fmtPeso(t.peso)}</span>
        </div>
        ${r.observacoes ? `<div class="card-obs">${escHtml(r.observacoes)}</div>` : ""}
      </div>
    `;
  }).join("");
}

function abrirFormulario() {
  document.getElementById("f-veiculo").value = "";
  document.getElementById("f-data").value = hoje();
  document.getElementById("f-obs").value = "";
  document.getElementById("form-overlay").style.display = "flex";
}

function fecharFormulario() {
  document.getElementById("form-overlay").style.display = "none";
}

async function salvarRomaneio() {
  const veiculo = document.getElementById("f-veiculo").value.trim();
  if (!veiculo) { alert("Informe o veículo/motorista"); return; }

  const ref = await colRomaneios.add({
    veiculo,
    data: document.getElementById("f-data").value || hoje(),
    observacoes: document.getElementById("f-obs").value.trim() || null,
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  fecharFormulario();
  abrirDetalhe(ref.id);
  abrirSelecaoPedidos();
}

function abrirDetalhe(id) {
  romaneioAtualId = id;
  renderDetalhe();
  document.getElementById("detalhe-overlay").style.display = "flex";
}

function fecharDetalhe() {
  romaneioAtualId = null;
  document.getElementById("detalhe-overlay").style.display = "none";
}

function renderDetalhe() {
  const r = romaneiosList.find(x => x.id === romaneioAtualId);
  if (!r) { fecharDetalhe(); return; }

  const pedidosDele = pedidosDoRomaneio(romaneioAtualId);
  const t = calcularTotais(pedidosDele);

  document.getElementById("detalhe-info").innerHTML = `
    <div class="card-nome" style="padding-right:0">${escHtml(r.veiculo)}</div>
    <div class="card-meta"><span>${fmtDataSimples(r.data)}</span></div>
    ${r.observacoes ? `<div class="card-obs">${escHtml(r.observacoes)}</div>` : ""}
  `;

  document.getElementById("detalhe-totais").innerHTML = `
    <div class="saldo-card" style="margin:12px 0">
      <div class="saldo-label">Total da carga</div>
      <div class="saldo-valor" style="font-size:1.3rem">${fmtMoeda(t.valor)}</div>
      <div class="card-meta" style="justify-content:center;color:#bbdefb;margin-top:6px">
        <span>${t.totalPedidos} pedido(s)</span>
        <span>${t.qtdItens} itens</span>
        <span>${fmtPeso(t.peso)}</span>
      </div>
    </div>
  `;

  document.getElementById("detalhe-pedidos").innerHTML = pedidosDele.length === 0
    ? '<div class="empty">Nenhum pedido neste romaneio</div>'
    : pedidosDele.map(p => `
      <div class="card">
        <div class="card-acoes">
          <button class="btn-del" onclick="removerPedidoDoRomaneio('${p.id}')">🗑️</button>
        </div>
        <div class="card-nome">${escHtml(p.cliente_nome)}</div>
        <div class="card-meta">
          <span>${(p.itens || []).length} item(ns)</span>
          <span>${fmtMoeda(p.total)}</span>
        </div>
      </div>
    `).join("");
}

async function removerPedidoDoRomaneio(pedidoId) {
  if (!confirm("Remover este pedido do romaneio?")) return;
  await colPedidosRom.doc(pedidoId).update({ romaneio_id: null });
}

async function excluirRomaneio(id) {
  id = id || romaneioAtualId;
  if (!id) return;
  if (!confirm("Excluir este romaneio? Os pedidos incluídos voltarão a ficar sem romaneio.")) return;

  const batch = db.batch();
  batch.delete(colRomaneios.doc(id));
  pedidosDoRomaneio(id).forEach(p => {
    batch.update(colPedidosRom.doc(p.id), { romaneio_id: null });
  });
  await batch.commit();

  if (romaneioAtualId === id) fecharDetalhe();
}

function abrirSelecaoPedidos() {
  renderSelecao();
  document.getElementById("selecao-overlay").style.display = "flex";
}

function fecharSelecaoPedidos() {
  document.getElementById("selecao-overlay").style.display = "none";
}

function renderSelecao() {
  const lista = document.getElementById("selecao-lista");
  const disponiveis = pedidosList.filter(p => !p.romaneio_id);

  if (disponiveis.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhum pedido disponível (sem romaneio)</div>';
    return;
  }

  lista.innerHTML = disponiveis.map(p => `
    <div class="card">
      <div class="card-nome">${escHtml(p.cliente_nome)}</div>
      <div class="card-meta">
        <span>${fmtDataSimples(p.criadoEm)}</span>
        <span>${(p.itens || []).length} item(ns)</span>
        <span>${fmtMoeda(p.total)}</span>
      </div>
      <button type="button" class="btn-save" style="margin-top:8px;width:100%" onclick="adicionarPedidoAoRomaneio('${p.id}')">+ Adicionar ao romaneio</button>
    </div>
  `).join("");
}

async function adicionarPedidoAoRomaneio(pedidoId) {
  if (!romaneioAtualId) return;
  await colPedidosRom.doc(pedidoId).update({ romaneio_id: romaneioAtualId });
}
