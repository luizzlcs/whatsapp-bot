const fs = require("fs");
const path = require("path");
const { formatarDataHora, formatarNomeArquivoData } = require("./utils");

class MessageManager {
  constructor(configDir, logsDir) {
    this.configDir = configDir;
    this.logsDir = logsDir;
    this.currentSessionLog = null;
    this.sessionStartTime = null;
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      failedNumbers: [],
      startTime: null,
      endTime: null,
      duration: null,
    };
  }

  initNewSession() {
    this.sessionStartTime = new Date();
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      failedNumbers: [],
      startTime: this.sessionStartTime,
      endTime: null,
      duration: null,
    };

    const sessionId = formatarNomeArquivoData(this.sessionStartTime);
    this.currentSessionLog = path.join(
      this.logsDir,
      `session_${sessionId}.log`
    );

    this.writeToLog(`===== INÍCIO DA SESSÃO =====`);
    this.writeToLog(`Data/Hora: ${formatarDataHora(this.sessionStartTime)}`);
    this.writeToLog("============================\n");
  }

  async loadContacts() {
    const numerosPath = path.join(this.configDir, "numeros.txt");

    if (!fs.existsSync(numerosPath)) {
      fs.writeFileSync(numerosPath, "5511999999999\n5511888888888");
      return [];
    }

    return fs
      .readFileSync(numerosPath, "utf8")
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n && !n.startsWith("//"))
      .map((n) => n.replace(/\D/g, "") + "@c.us");
  }

  async loadMessage() {
    const mensagemPath = path.join(this.configDir, "mensagem.txt");

    if (!fs.existsSync(mensagemPath)) {
      const conteudoPadrao = `Olá! Esta é uma mensagem de exemplo.
 Modifique este arquivo com sua mensagem real.
    
Atenciosamente,
Seu Nome`;

      fs.writeFileSync(mensagemPath, conteudoPadrao);
      return conteudoPadrao;
    }

    return fs.readFileSync(mensagemPath, "utf8");
  }

  logMessageSent(number, success = true, error = null) {
    this.stats.total++;

    if (success) {
      this.stats.success++;
      this.writeToLog(
        `✅ ${formatarDataHora(new Date())} | Mensagem enviada para: ${number}`
      );
    } else {
      this.stats.failed++;
      const cleanNumber = number.replace("@c.us", "");
      this.stats.failedNumbers.push(cleanNumber);

      const errorMsg = error ? ` | Erro: ${error.message || error}` : "";
      this.writeToLog(
        `❌ ${formatarDataHora(
          new Date()
        )} | Falha ao enviar para: ${cleanNumber}${errorMsg}`
      );
    }
  }

  writeToLog(content) {
    if (!this.currentSessionLog) return;

    try {
      fs.appendFileSync(this.currentSessionLog, content + "\n", "utf8");
    } catch (error) {
      console.error("Erro ao escrever no log:", error);
    }
  }

  finalizeSession() {
    if (!this.sessionStartTime) return null; // Retorna null se não houver sessão iniciada

    const endTime = new Date();
    const durationMs = endTime - this.sessionStartTime;
    const durationStr = this.formatDuration(durationMs);

    // Calcula porcentagens
    const successPercent =
      this.stats.total > 0
        ? Math.round((this.stats.success / this.stats.total) * 100)
        : 0;
    const failedPercent =
      this.stats.total > 0
        ? Math.round((this.stats.failed / this.stats.total) * 100)
        : 0;

    // Atualiza as estatísticas
    const finalStats = {
      ...this.stats,
      endTime,
      duration: durationStr,
      successPercent,
      failedPercent,
    };

    this.writeToLog("\n===== RESUMO DA SESSÃO =====");
    this.writeToLog(`📅 Início: ${formatarDataHora(this.sessionStartTime)}`);
    this.writeToLog(`🏁 Término: ${formatarDataHora(endTime)}`);
    this.writeToLog(`⏱ Duração: ${durationStr}`);
    this.writeToLog(`📤 Total de números processados: ${finalStats.total}`);
    this.writeToLog(
      `✅ Total de mensagens enviadas com sucesso: ${finalStats.success} (${finalStats.successPercent}%)`
    );
    this.writeToLog(
      `❌ Total de mensagens não enviadas: ${finalStats.failed} (${finalStats.failedPercent}%)`
    );

    if (finalStats.failed > 0) {
      this.writeToLog("===========================");
      this.writeToLog("⚠️ NÚMEROS COM FALHAS");
      this.writeToLog("===========================");
      this.writeToLog(finalStats.failedNumbers.join("\n"));
    }

    return finalStats;
  }

  formatDuration(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);

    return [
      hours > 0 ? `${hours}h` : "",
      minutes > 0 ? `${minutes}m` : "",
      `${seconds}s`,
    ]
      .filter(Boolean)
      .join(" ");
  }

  getStats() {
    return this.stats;
  }
}

module.exports = MessageManager;
