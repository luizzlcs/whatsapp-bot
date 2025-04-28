function formatarDataHora(date) {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, "0");
  const minutos = String(date.getMinutes()).padStart(2, "0");
  const segundos = String(date.getSeconds()).padStart(2, "0");

  return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

function formatarNomeArquivoData(date) {
  const dia = String(date.getDate()).padStart(2, "0");
  const mes = String(date.getMonth() + 1).padStart(2, "0");
  const ano = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, "0");
  const minutos = String(date.getMinutes()).padStart(2, "0");
  const segundos = String(date.getSeconds()).padStart(2, "0");

  return `${dia}-${mes}-${ano}_${horas}-${minutos}-${segundos}`;
}

function mostrarLoading(mensagemInicial = "Verificando") {
  const frames = [
    "[▰▱▱▱▱▱▱]",
    "[▰▰▱▱▱▱▱]",
    "[▰▰▰▱▱▱▱]",
    "[▰▰▰▰▱▱▱]",
    "[▰▰▰▰▰▱▱]",
    "[▰▰▰▰▰▰▱]",
    "[▰▰▰▰▰▰▰]",
    "[▰▰▰▰▰▰▱]",
    "[▰▰▰▰▰▱▱]",
    "[▰▰▰▰▱▱▱]",
    "[▰▰▰▱▱▱▱]",
    "[▰▰▱▱▱▱▱]",
  ];
  let i = 0;
  const mensagemBase = `🔍 ${mensagemInicial} `;

  const interval = setInterval(() => {
    process.stdout.clearLine(process.stdout.columns);
    process.stdout.cursorTo(0);
    process.stdout.write(mensagemBase + frames[(i = (i + 1) % frames.length)]);
  }, 120);

  return {
    stop: (mensagemFinal = "Verificação concluída!") => {
      clearInterval(interval);
      process.stdout.clearLine(process.stdout.columns);
      process.stdout.cursorTo(0);
      process.stdout.write(`✔ ${mensagemFinal}` + " ".repeat(30) + "\n");
    },
  };
}

function atualizarBarraProgresso({
  progresso,
  total,
  enviadas,
  sucessos,
  falhas,
  tempoDecorrido,
  tempoRestante,
}) {
  const totalBlocos = 25;
  const blocosCompletos = Math.max(
    0,
    Math.min(totalBlocos, Math.floor((progresso / 100) * totalBlocos))
  );
  const blocosRestantes = totalBlocos - blocosCompletos;

  // Previne erro se valores inválidos forem passados
  const barra = '█'.repeat(blocosCompletos) + '░'.repeat(blocosRestantes);

  // Formatação de tempo segura
  const formatarTempo = (segundos) => {
    segundos = Math.max(0, Math.round(segundos));
    return segundos < 60
      ? `${segundos}s`
      : `${Math.floor(segundos / 60)}m${segundos % 60}s`;
  };

  const linha =
    `🔄 Progresso: [${barra}] ${progresso.toFixed(2)}% | ` +
    `📱 ${enviadas}/${total} | ` +
    `✅ ${sucessos} sucesso | ` +
    `❌ ${falhas} falhas | ` +
    `⏱️ ${formatarTempo(tempoDecorrido)} / ~${formatarTempo(tempoRestante)}`;

  // Limpa a linha atual e escreve a nova
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(linha);

  // Quebra de linha quando completar
  if (progresso >= 100) {
    process.stdout.write("\n");
  }
}

module.exports = {
  formatarDataHora,
  formatarNomeArquivoData,
  mostrarLoading,
  atualizarBarraProgresso,
};