const colContasReceber = db.collection("contasReceber");

colContasReceber.orderBy("criadoEm", "desc").onSnapshot(snap => {
  const contas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(contas);
});

function render(contas) {
  const lista = document.getElementById("lista");

  if (contas.length === 0) {
    lista.innerHTML = '<div class="empty">Nenhuma conta a receber</div>';
    return;
  }

  lista.innerHTML = contas.map(c => `
    <div class="card">
      <div class="card-nome">
        ${escHtml(c.descricao)}
        <span class="badge-status ${c.status === "Recebido" ? "entregue" : "pendente"}">${escHtml(c.status)}</span>
      </div>
      <div class="card-meta">
        <span>${fmtDataSimples(c.criadoEm)}</span>
        <span class="valor-entrada">${fmtMoeda(c.valor)}</span>
      </div>
      ${c.status === "Pendente" ? `<button class="btn-baixa" onclick="darBaixa('${c.id}')">Dar baixa</button>` : ""}
    </div>
  `).join("");
}

async function darBaixa(id) {
  if (!confirm("Confirmar recebimento? O valor será lançado no Caixa.")) return;
  const snap = await colContasReceber.doc(id).get();
  const conta = snap.data();
  const batch = db.batch();
  batch.update(colContasReceber.doc(id), { status: "Recebido" });
  const lancRef = db.collection("caixaLancamentos").doc();
  batch.set(lancRef, {
    data: hoje(),
    descricao: `Recebimento: ${conta.descricao}`,
    tipo: "entrada",
    valor: conta.valor,
    origem: "baixa_receber",
    criadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });
  await batch.commit();
}
