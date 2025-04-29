// Gerar Executável para windows: pkg index.js --targets win-x64 --output whatsapp-bot.exe

const MessageManager = require("./messageManager");
// Fix para axios em executáveis
if (process.pkg) {
  const path = require("path");
  const axiosPath = path.join(
    path.dirname(process.execPath),
    "node_modules",
    "axios"
  );
  try {
    require(axiosPath);
  } catch (e) {
    // Ignore se não encontrar
  }
}

// Solução definitiva para executáveis Windows
if (process.pkg && process.platform === "win32") {
  // Impedir que o console feche em erros não tratados
  process.on("uncaughtException", (err) => {
    console.error("Erro não tratado:", err);
    console.log("\nPressione ENTER para sair...");
    require("readline")
      .createInterface({
        input: process.stdin,
        output: process.stdout,
      })
      .question("", () => process.exit(1));
  });

  // Manter o processo ativo
  const keepAlive = setInterval(() => {}, 1000);
  process.on("exit", () => clearInterval(keepAlive));
}

const path = require("path");
const whatsapp = require("whatsapp-web.js");
const qrcode = require("qrcode");
const fs = require("fs");
const { exec } = require("child_process");
const axios = require("axios");
const readline = require("readline");
const https = require("https");
const crypto = require("crypto");
const dgram = require("dgram");
const firebaseService = require("./firebaseService");
const licenseManager = require("./licenseManager");
const chalk = require('chalk');

// Configuração global do Axios
axios.defaults.httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  timeout: 10000,
});

// ==================== ESTRUTURA DE DIRETÓRIOS ====================
const execDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const logsDir = path.join(execDir, "logs");
const configDir = path.join(execDir, "config");
const tempDir = path.join(execDir, "temp");
const sessionDir = path.join(execDir, ".wwebjs_auth");
const securityDir = path.join(sessionDir, "security");

// Criar diretórios necessários
[logsDir, configDir, tempDir, sessionDir, securityDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ==================== FUNÇÕES AUXILIARES ====================
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
  return formatarDataHora(date).replace(/[\/: ]/g, "-");
}

function showBotAlreadyRunning() {
  console.log('\n');
  console.log(chalk.red('╔══════════════════════════════════════════════════╗'));
  console.log(chalk.red('║ 🚫 ATENÇÃO:                                      ║'));
  console.log(chalk.red('║                                                  ║'));
  console.log(chalk.red('║  O WhatsApp Bot já está em execução!             ║'));
  console.log(chalk.red('║                                                  ║'));
  console.log(chalk.red('╚══════════════════════════════════════════════════╝'));
  console.log('\n');
}

function registrarErroDetalhado(error, contexto = "Erro não especificado") {
  try {
    const logDir = path.join(execDir, "logs");
    const logPath = path.join(
      logDir,
      `error_${formatarNomeArquivoData(new Date())}.txt`
    );

    const mensagemErro = `
===== REGISTRO DE ERRO =====
Data/Hora: ${formatarDataHora(new Date())}
Contexto: ${contexto}
Mensagem: ${error.message}
===========================`;

    fs.writeFileSync(logPath, mensagemErro, "utf8");
    console.error(mensagemErro);
    return logPath;
  } catch (err) {
    console.error("Falha ao registrar erro:", err);
    console.error("Erro original:", error);
    return null;
  }
}

function aguardarTeclaParaSair(mensagemErro = null) {
  return new Promise((resolve) => {
    if (mensagemErro) console.error(mensagemErro);
    console.log("\nPressione ENTER para sair...");

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question("", () => {
      rl.close();
      process.exit(0);
    });
  });
}

// ==================== SISTEMA DE SEGURANÇA ====================
class TimeSecurity {
  generateMachineHash() {
    const machineId =
      process.env.COMPUTERNAME ||
      process.env.HOSTNAME ||
      crypto.randomBytes(16).toString("hex");
    return crypto.createHash("sha256").update(machineId).digest();
  }

  async saveTimeCheckpoint() {
    const timeData = {
      timestamp: Date.now(),
      systemTime: new Date().getTime(),
      envHash: this.createEnvironmentHash(),
    };

    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      this.generateMachineHash(),
      Buffer.alloc(12)
    );
    let encrypted = cipher.update(JSON.stringify(timeData), "utf8", "hex");
    encrypted += cipher.final("hex");

    fs.writeFileSync(path.join(securityDir, "time.dat"), encrypted);
  }

  createEnvironmentHash() {
    return crypto
      .createHash("sha256")
      .update(process.env.PATH + JSON.stringify(process.versions) + execDir)
      .digest("hex");
  }
}

// ==================== CONFIGURAÇÃO DO WHATSAPP CLIENT ====================
async function criarClienteWhatsApp() {
  const chromePath = [
    process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
    process.env["PROGRAMFILES(X86)"] +
      "\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((path) => fs.existsSync(path));

  if (!chromePath) {
    throw new Error("Navegador Chrome não encontrado");
  }

  // Verificar e tratar lockfile
  try {
    const lockfile = path.join(
      sessionDir,
      "session-whatsapp-bot-client",
      "lockfile"
    );

    if (fs.existsSync(lockfile)) {
      showBotAlreadyRunning();
      // console.error("\n🚫 ATENÇÃO: O WhatsApp Bot já está em execução!");
      console.log(
        "Por favor, feche a aplicação existente antes de iniciar uma nova instância."
      );
      console.log("\nSe você acredita que isto é um erro, pode tentar:");
      console.log("1. Fechar todas as instâncias do WhatsApp Bot");
      console.log("2. Reiniciar seu computador");
      console.log("3. Excluir manualmente o arquivo de lock em:");
      console.log(lockfile);

      await aguardarTeclaParaSair();
      process.exit(1);
    }
  } catch (e) {
    if (e.code === "EBUSY") {
      console.error("\n🚫 ATENÇÃO: O WhatsApp Bot já está em execução!");
      console.log(
        "Por favor, feche a aplicação existente antes de iniciar uma nova instância."
      );
      await aguardarTeclaParaSair();
      process.exit(1);
    } else {
      console.warn("⚠️ Aviso ao verificar lockfile:", e.message);
    }
  }

  const client = new whatsapp.Client({
    authStrategy: new whatsapp.LocalAuth({
      dataPath: sessionDir,
      clientId: "whatsapp-bot-client",
      bypassPathCheck: true,
    }),
    puppeteer: {
      headless: false,
      executablePath: chromePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
      timeout: 60000,
      ignoreDefaultArgs: ["--disable-extensions"],
    },
    takeoverOnConflict: false,
    qrMaxRetries: 3,
    restartOnAuthFail: true,
  });

  return client;
}

// ==================== CONFIGURAÇÃO DE EVENTOS ====================
function configurarEventosWhatsApp(client) {
  let reconectando = false;
  let qrCodeGenerated = false;

  // Evento quando o QR Code é gerado
  client.on("qr", async (qr) => {
    if (qrCodeGenerated) return; // Evitar gerar múltiplos QR Codes
    qrCodeGenerated = true;

    console.log("🔎 QR Code recebido - Escaneie para autenticar");
    const qrCodePath = path.join(tempDir, "qrcode.png");

    try {
      // Gerar imagem do QR Code
      await qrcode.toFile(qrCodePath, qr);
      console.log(`📷 QR Code salvo em: ${qrCodePath}`);

      // Tentar abrir a imagem automaticamente
      if (process.platform === "win32") {
        exec(`start "" "${qrCodePath}"`, (error) => {
          if (error) {
            console.log("ℹ️ Não foi possível abrir a imagem automaticamente.");
            console.log("ℹ️ Abra manualmente o arquivo em:", qrCodePath);
          }
        });
      }

      // Mostrar QR Code no terminal como fallback
      // qrcode.toString(qr, { type: 'terminal' }, (err, qrTerminal) => {
      //   if (!err) {
      //     console.log("\n🔢 QR Code para escaneamento (terminal):");
      //     console.log(qrTerminal);
      //   }
      // });
    } catch (err) {
      console.error("❌ Erro ao gerar QR Code:", err);
      registrarErroDetalhado(err, "Erro ao gerar QR Code");
    }
  });

  // Evento quando autenticado com sucesso
  client.on("authenticated", () => {
    console.log("✅ Autenticado com sucesso! Sessão salva.");
    qrCodeGenerated = false; // Resetar flag para reconexões futuras
    try {
      fs.writeFileSync(path.join(sessionDir, "auth_verified"), "true");
    } catch (err) {
      console.error("❌ Erro ao salvar verificação de autenticação:", err);
    }
  });

  // Evento quando há falha na autenticação
  client.on("auth_failure", (msg) => {
    console.error("❌ Falha na autenticação:", msg);
    registrarErroDetalhado(new Error(msg), "Falha na autenticação");
    qrCodeGenerated = false; // Permitir novo QR Code

    if (!reconectando) {
      setTimeout(() => reconectarClient(client), 5000);
    }
  });

  // Evento quando o cliente está pronto
  client.on("ready", () => {
    console.log("✅ WhatsApp Client pronto para uso");
    qrCodeGenerated = false;
  });

  // Evento quando desconectado
  client.on("disconnected", async (reason) => {
    console.log("🚨 Desconectado:", reason);
    registrarErroDetalhado(new Error(reason), "Conexão perdida");
    qrCodeGenerated = false;

    if (!reconectando) {
      reconectando = true;
      await reconectarClient(client);
      reconectando = false;
    }
  });

  // Evento de mudança de estado
  client.on("change_state", (state) => {
    console.log("🔄 Mudança de estado:", state);
  });

  // Evento de mensagem recebida
  client.on("message", (msg) => {
    if (msg.fromMe) return; // Ignorar mensagens enviadas pelo próprio bot

    // Exemplo: Responder mensagens específicas
    if (msg.body.toLowerCase() === "ping") {
      client.sendMessage(msg.from, "Pong!");
    }
  });

  // Ping periódico para manter conexão ativa
  const keepAliveInterval = setInterval(() => {
    if (client && client.pupPage && !client.pupPage.isClosed()) {
      client.pupPage
        .evaluate(() => {
          try {
            window.Store.Presence.setAvailable();
          } catch (e) {
            console.error("Erro no ping de conexão:", e);
          }
        })
        .catch(() => {});
    }
  }, 30000);

  // Limpar intervalo quando o cliente for destruído
  client.on("disconnected", () => {
    clearInterval(keepAliveInterval);
  });

  // Log de erros internos
  client.on("error", (error) => {
    console.error("❌ Erro interno do cliente:", error);
    registrarErroDetalhado(error, "Erro interno do cliente WhatsApp");
  });
}

// ==================== RECONEXÃO AUTOMÁTICA ====================
async function reconectarClient(client) {
  console.log("⚡ Tentando reconectar...");

  try {
    if (client.pupBrowser) {
      await client.pupBrowser.close().catch(() => {});
    }

    client.removeAllListeners();
    await client.initialize();
    configurarEventosWhatsApp(client);

    console.log("✅ Reconexão bem-sucedida");
  } catch (error) {
    console.error("❌ Falha na reconexão:", error.message);
    setTimeout(() => reconectarClient(client), 10000);
  }
}

// ==================== ENVIO DE MENSAGENS ====================
async function enviarMensagens(client) {
  const { atualizarBarraProgresso } = require("./utils");

  // Verificação de licença
  const licenseCheck = await licenseManager.validateLicense();
  if (!licenseCheck?.valid) {
    console.error("❌ Licença inválida ou não verificada");
    return null;
  }

  const messageManager = new MessageManager(configDir, logsDir);
  messageManager.initNewSession();

  try {
    const numeros = await messageManager.loadContacts();
    const mensagem = await messageManager.loadMessage();

    console.log(`📤 Iniciando envio para ${numeros.length} números...`);

    const inicio = Date.now();
    let enviadas = 0;
    let sucessos = 0;
    let falhas = 0;

    // Mostra barra inicial
    atualizarBarraProgresso({
      progresso: 0,
      total: numeros.length,
      enviadas: 0,
      sucessos: 0,
      falhas: 0,
      tempoDecorrido: 0,
      tempoRestante: 0,
    });

    for (const numero of numeros) {
      try {
        const contato = await client.getNumberId(numero);
        if (!contato) {
          falhas++;
          messageManager.logMessageSent(
            numero,
            false,
            new Error("Número não encontrado")
          );
          continue;
        }

        await client.sendMessage(contato._serialized, mensagem);
        sucessos++;
        messageManager.logMessageSent(numero, true);
      } catch (error) {
        falhas++;
        messageManager.logMessageSent(numero, false, error);
      } finally {
        enviadas++;
        const tempoDecorrido = (Date.now() - inicio) / 1000;
        const progresso = (enviadas / numeros.length) * 100;
        const tempoMedioPorMsg = tempoDecorrido / enviadas;
        const tempoRestante = Math.max(
          0,
          (numeros.length - enviadas) * tempoMedioPorMsg
        );

        atualizarBarraProgresso({
          progresso,
          total: numeros.length,
          enviadas,
          sucessos,
          falhas,
          tempoDecorrido,
          tempoRestante,
        });

        // Delay aleatório entre 1-3 segundos
        await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
      }
    }

    // Finaliza a sessão e obtém estatísticas
    const stats = messageManager.finalizeSession();

    // Garantir quebra de linha no fim
    process.stdout.write("\n");

    if (stats) {
      console.log(`
========================
   📋 RESUMO DO ENVIO:
========================
  📤 Total de números processados: ${stats.total}
  ✅ Total de mensagens enviadas com sucesso: ${stats.success} (${
        stats.successPercent
      }%)
  ❌ Total de mensagens não enviadas: ${stats.failed} (${stats.failedPercent}%)
  ⏱  Duração: ${stats.duration}
${
  stats.failed > 0
    ? `
===========================
  ⚠️  NÚMEROS COM FALHAS:
===========================
    \n${stats.failedNumbers.join("\n")}  
        `
    : ""
}
===========================
`);
    }

    // Mensagem final com instruções
    console.log(`
🔄 O programa continuará em execução para manter a sessão do WhatsApp ativa.
🛑 Para encerrar, pressione ENTER ou feche esta janela.
💡 Para enviar mais mensagens, edite os arquivos de configuração e reinicie o programa.
`);

    // Aguardar ENTER para sair
    await new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question("", () => {
        rl.close();
        resolve();
        process.exit(0);
      });
    });

    return stats;
  } catch (error) {
    console.error("❌ Erro no processo de envio:", error);
    messageManager.logMessageSent("GLOBAL", false, error);
    const stats = messageManager.finalizeSession();
    return stats || { success: 0, failed: 1, failedNumbers: ["Erro global"] };
  }
}

// ==================== FUNÇÃO PRINCIPAL ====================
async function main() {
  const localTime = new Date();

  try {
    // =============  VERIFICAÇÃO DE LICENÇA =============
    console.log(
      "🕒 " + formatarDataHora(new Date()) + " | Iniciando verificação"
    );

    const licenseCheck = await licenseManager.validateLicense();
    // 1. Validar licença
    if (!licenseCheck.valid) {
      console.error(`❌ ${licenseCheck.reason}`);
      await aguardarTeclaParaSair();
      process.exit(1);
    }

    console.log("\n✅ Licença válida! Detalhes:");
    console.log(`👤 Nome: ${licenseCheck.userData.name}`);
    console.log(`📧 Email: ${licenseCheck.userData.email}`);
    console.log(
      `📅 Expiração: ${new Date(
        licenseCheck.userData.expirationDate
      ).toLocaleDateString()}`
    );
    console.log(`🕒 ${formatarDataHora(localTime)} | Fonte: Local`);
    console.log(
      `💻 Dispositivos: ${licenseCheck.userData.activeDevices}/${licenseCheck.userData.maxDevices} ativos`
    );
    console.log(`🖥️  ID do dispositivo: ${licenseCheck.deviceId}`);

    // ============= FIM DO BLOCO DE VERIFICAÇÃO DE LICENÇA =============

    // 1. Iniciar WhatsApp Client
    // ============= INICIALIZAÇÃO DO WHATSAPP =============
    console.log("🔴 Iniciando WhatsApp Bot...");
    const client = await criarClienteWhatsApp();

    // 2. Configurar eventos ANTES de inicializar
    configurarEventosWhatsApp(client);

    // 3. Inicializar o cliente
    await client.initialize();
    // await new Promise((resolve) => client.once("ready", resolve));

    // 4. Aguardar autenticação/ready
    await new Promise((resolve) => {
      const readyHandler = () => {
        client.off("ready", readyHandler);
        resolve();
      };
      client.on("ready", readyHandler);

      // Timeout para evitar espera infinita
      setTimeout(() => {
        if (!client.pupPage) {
          console.error("❌ Tempo excedido aguardando autenticação");
          process.exit(1);
        }
      }, 300000); // 5 minutos de timeout
    });

    // 5. Iniciar envio de mensagens
    await enviarMensagens(client);

    // 6. Manter processo ativo
    await new Promise(() => {});
  } catch (error) {
    console.error("❌ Erro no processo principal:", error.message);
    await aguardarTeclaParaSair();
    process.exit(1);
  } finally {
    licenseManager.closeReadline();
  }
}

// Iniciar aplicação
main().catch((err) => {
  registrarErroDetalhado(err, "Erro no processo principal");
  process.exit(1);
});
