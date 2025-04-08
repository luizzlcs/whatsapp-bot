const fs = require("fs");
const path = require("path");
const readline = require("readline");
const firebaseService = require("./firebaseService");
const { formatarDataHora } = require("./utils");

class LicenseManager {
  constructor() {
    this.sessionPath = path.join(
      process.pkg ? path.dirname(process.execPath) : __dirname,
      ".wwebjs_auth",
      "session",
      "user.json"
    );
  }

  async getStoredEmail() {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const data = fs.readFileSync(this.sessionPath, "utf8");
        const user = JSON.parse(data);
        return user.email || null;
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async promptForEmail() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
        "📧 Por favor, insira o email cadastrado na sua licença: ",
        (email) => {
          rl.close();
          resolve(email.trim());
        }
      );
    });
  }

  async validateLicense() {
    try {
      console.log("\n🔍 Verificando licença...");

      // 1. Obter email do usuário
      let email = await this.getStoredEmail();
      if (!email) {
        email = await this.promptForEmail();
      }

      // 2. Gerar ID do dispositivo
      const deviceId = firebaseService.generateDeviceId();
      console.log(`🖥️  ID do dispositivo: ${deviceId}`);

      // 3. Validar licença no Firebase
      const validation = await firebaseService.validateLicense(email, deviceId);

      if (!validation.valid) {
        console.error(`❌ Falha na validação: ${validation.reason}`);
        return { isValid: false, reason: validation.reason };
      }

      // 4. Verificar expiração da licença
      const expirationCheck = await this.checkExpirationWarning(
        validation.userData
      );
      if (!expirationCheck.continue) {
        return {
          isValid: false,
          reason: "Usuário cancelou devido à expiração próxima",
        };
      }

      // 5. Mostrar informações da licença
      console.log("\n✅ Licença válida! Detalhes:");
      console.log(
        `👤 Nome: ${validation.userData.name || validation.userData.nome}`
      );
      console.log(`📧 Email: ${validation.userData.email}`);
      console.log(
        `📅 Expiração: ${formatarDataHora(
          new Date(validation.userData.expirationDate)
        )}`
      );
      console.log(`⏳ Dias restantes: ${expirationCheck.daysLeft}`);
      console.log(
        `💻 Dispositivos permitidos: ${validation.userData.maxDevices}`
      );
      console.log(
        `🔓 Dispositivo atual: ${
          validation.userData.currentDevice.blocked ? "Bloqueado" : "Ativo"
        }`
      );
      console.log(
        `🔄 Último acesso: ${formatarDataHora(
          new Date(validation.userData.currentDevice.lastAccess)
        )}`
      );

      // 6. Salvar email na sessão se não existir
      if (!(await this.getStoredEmail())) {
        this.saveEmailToSession(email);
      }

      return {
        isValid: true,
        userData: {
          ...validation.userData,
          daysLeft: expirationCheck.daysLeft,
        },
        deviceId: deviceId,
      };
    } catch (error) {
      console.error("❌ Erro no gerenciador de licenças:", error.message);
      return { isValid: false, reason: error.message };
    }
  }

  saveEmailToSession(email) {
    try {
      const dir = path.dirname(this.sessionPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.sessionPath, JSON.stringify({ email }), "utf8");
    } catch (error) {
      console.error(
        "⚠️ Não foi possível salvar o email na sessão:",
        error.message
      );
    }
  }

  async checkExpirationWarning(userData) {
    try {
      const currentTime = await firebaseService.getCurrentInternetTime();
      const expirationDate = new Date(userData.expirationDate);
      const timeDiff = expirationDate.getTime() - currentTime.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

      if (daysLeft <= 30) {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        console.log(
          "\n\x1b[43m\x1b[30m⚠️ ALERTA DE EXPIRAÇÃO DE ASSINATURA ⚠️\x1b[0m"
        );
        console.log(
          `\n• Sua assinatura expirará em \x1b[33m${daysLeft} dias\x1b[0m.`
        );
        console.log(
          `• Após \x1b[31m${formatarDataHora(expirationDate)}\x1b[0m,`
        );
        console.log("  não será possível enviar mensagens.\n");

        const answer = await new Promise((resolve) => {
          rl.question("Deseja continuar? (s/n): ", (input) => {
            rl.close();
            resolve(input.trim().toLowerCase());
          });
        });

        if (answer !== "s") {
          return { continue: false, daysLeft };
        }
      }

      return { continue: true, daysLeft };
    } catch (error) {
      console.error("Erro ao verificar expiração:", error.message);
      return { continue: true, daysLeft: 365 }; // Assume 1 ano se não conseguir calcular
    }
  }
}

module.exports = new LicenseManager();
