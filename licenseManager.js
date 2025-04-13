const fs = require("fs");
const path = require("path");
const readline = require("readline");
const firebaseService = require("./firebaseService");

class LicenseManager {
  constructor() {
    this.sessionDir = path.join(
      process.pkg ? path.dirname(process.execPath) : __dirname,
      ".wwebjs_auth",
      "session"
    );
    this.emailPath = path.join(this.sessionDir, "email.json");
    this.devicePath = path.join(this.sessionDir, "device.json");
  }

  async ensureSessionDir() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
    }
  }

  async getStoredEmail() {
    try {
      await this.ensureSessionDir();
      if (fs.existsSync(this.emailPath)) {
        const data = fs.readFileSync(this.emailPath, "utf8");
        const { email } = JSON.parse(data);
        return email;
      }
      return null;
    } catch (error) {
      console.error("Erro ao ler email salvo:", error);
      return null;
    }
  }

  async getStoredDeviceId() {
    try {
      await this.ensureSessionDir();
      if (fs.existsSync(this.devicePath)) {
        const data = fs.readFileSync(this.devicePath, "utf8");
        const { deviceId } = JSON.parse(data);
        return deviceId;
      }
      return null;
    } catch (error) {
      console.error("Erro ao ler dispositivo salvo:", error);
      return null;
    }
  }

  async saveSessionData(email, deviceId) {
    try {
      await this.ensureSessionDir();
      
      fs.writeFileSync(
        this.emailPath,
        JSON.stringify({ email }),
        "utf8"
      );
      
      fs.writeFileSync(
        this.devicePath,
        JSON.stringify({ deviceId }),
        "utf8"
      );
      
      return true;
    } catch (error) {
      console.error("Erro ao salvar dados da sessão:", error);
      return false;
    }
  }

  async promptForEmail() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question("📧 Digite o email cadastrado na sua licença: ", (email) => {
        rl.close();
        resolve(email.trim());
      });
    });
  }

  async validateLicense() {
    try {
      // 1. Obter email do usuário
      let email = await this.getStoredEmail();
      if (!email) {
        email = await this.promptForEmail();
        if (!email) {
          return { valid: false, reason: "Email não fornecido" };
        }
      }

      // 2. Gerar/recuperar ID do dispositivo
      let deviceId = await this.getStoredDeviceId();
      if (!deviceId) {
        deviceId = firebaseService.generateDeviceId();
      }
      
      console.log("🖥️  ID do dispositivo:", deviceId);

      // 3. Validar licença no Firebase
      const validation = await firebaseService.validateLicense(email, deviceId);
      if (!validation.valid) {
        return validation;
      }

      // 4. Verificar expiração próxima
      const expirationCheck = await this.checkExpirationWarning(
        validation.userData
      );
      if (!expirationCheck.continue) {
        return { valid: false, reason: "Usuário cancelou devido à expiração" };
      }

      // 5. Salvar dados da sessão
      await this.saveSessionData(email, deviceId);

      return {
        valid: true,
        userData: {
          ...validation.userData,
          daysLeft: expirationCheck.daysLeft
        },
        deviceId: deviceId
      };

    } catch (error) {
      console.error("Erro na validação da licença:", error);
      return { valid: false, reason: error.message };
    }
  }

  async checkExpirationWarning(userData) {
    const currentTime = await firebaseService.getCurrentInternetTime();
    const expirationDate = new Date(userData.expirationDate);
    const daysLeft = Math.ceil(
      (expirationDate - currentTime) / (1000 * 60 * 60 * 24)
    );

    if (daysLeft <= 7) {
      console.log("\n⚠️ ATENÇÃO: SUA LICENÇA IRÁ EXPIRAR EM BREVE ⚠️");
      console.log(`📅 Data de expiração: ${expirationDate.toLocaleDateString()}`);
      console.log(`⏳ Dias restantes: ${daysLeft}`);

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise((resolve) => {
        rl.question("Deseja continuar mesmo assim? (s/n): ", (input) => {
          rl.close();
          resolve(input.trim().toLowerCase() === "s");
        });
      });

      if (!answer) {
        return { continue: false, daysLeft };
      }
    }

    return { continue: true, daysLeft };
  }

  async getActiveDevices(email) {
    try {
      const licenseData = await firebaseService.getUserLicense(email);
      if (!licenseData) return null;
      
      return {
        active: licenseData.devices?.filter(d => !d.blocked) || [],
        blocked: licenseData.devices?.filter(d => d.blocked) || [],
        maxDevices: licenseData.maxDevices
      };
    } catch (error) {
      console.error("Erro ao obter dispositivos:", error);
      return null;
    }
  }
}

module.exports = new LicenseManager();