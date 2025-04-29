const fs = require("fs").promises;
const path = require("path");
const readline = require("readline").promises;
const crypto = require("crypto");
const { mostrarLoading } = require("./utils");
const { formatarDataHora } = require("./utils");
const firebaseService = require("./firebaseService");
const chalk = require("chalk");

class LicenseManager {
  constructor() {
    this.sessionDir = path.join(
      process.pkg ? path.dirname(process.execPath) : __dirname,
      ".wwebjs_auth"
    );
    this.cacheFile = path.join(this.sessionDir, "license_cache.json");
    this.cacheDurationDays = 5;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.licenseChecked = false; // Adicionado para controlar se a verificação já foi feita
  }

  showSolution() {
    console.log("\n");
    console.log(chalk.green("🔁 Mas calma, isso tem solução!"));
    console.log(
      chalk.green(
        "Se você já renovou sua licença ou deseja reativar o acesso, entre em contato com o suporte:"
      )
    );
    console.log(chalk.redBright("📩 Email: luizzlcs@gmail.com"));
    console.log(chalk.redBright("💬 Telegram: https://t.me/luizzlcs"));
    console.log(chalk.green("Obrigado por usar nosso aplicativo 💙"));
    console.log(chalk.green("Estamos prontos para te ajudar!"));
  }

  async ensureSessionDir() {
    try {
      await fs.mkdir(this.sessionDir, { recursive: true });
    } catch (error) {
      console.error("Erro ao criar diretório de sessão:", error);
    }
  }

  async getCachedLicenseData() {
    try {
      await this.ensureSessionDir();
      if (await this.fileExists(this.cacheFile)) {
        const data = await fs.readFile(this.cacheFile, "utf8");
        const cachedData = JSON.parse(data);
        if (cachedData && cachedData.hash && cachedData.data) {
          const currentHash = this.generateHash(
            JSON.stringify(cachedData.data)
          );
          if (currentHash === cachedData.hash) {
            return cachedData.data;
          } else {
            console.warn("⚠️ Cache de licença corrompido. Revalidando.");
            return null;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Erro ao ler dados do cache:", error);
      return null;
    }
  }

  async saveLicenseDataToCache(licenseData, deviceId) {
    try {
      await this.ensureSessionDir();
      const dataToCache = {
        ...licenseData,
        deviceId,
        lastValidation: Date.now(),
      };
      const hash = this.generateHash(JSON.stringify(dataToCache));
      const cacheEntry = { hash, data: dataToCache };
      await fs.writeFile(this.cacheFile, JSON.stringify(cacheEntry), "utf8");
      return true;
    } catch (error) {
      console.error("Erro ao salvar dados no cache:", error);
      return false;
    }
  }

  generateHash(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async promptForEmail() {
    try {
      const email = await this.rl.question(
        "📧 Digite o email cadastrado na sua licença: "
      );
      return email.trim();
    } finally {
      // Não fechar aqui, a interface será fechada em closeReadline
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  async showExpirationWarning(daysLeft, expirationDate) {
    console.log("\n⚠️  ATENÇÃO: SUA LICENÇA IRÁ EXPIRAR EM BREVE ⚠️");
    console.log(`📅 Data de expiração: ${formatarDataHora(new Date(expirationDate)) }`);
    console.log(`⏳ Dias restantes: ${daysLeft}`);

    try {
      this.showSolution();

      const answer = await this.rl.question(
        "Deseja continuar mesmo assim? (s/n): "
      );

      return answer.trim().toLowerCase() === "s";
    } catch (error) {
      return false;
    }
  }

  async validateLicense() {
    if (this.licenseChecked) {
      return { valid: true }; // Retorna válido se já foi verificado
    }

    let loading = mostrarLoading("🔍 Verificando licença");
    try {
      let cachedData = await this.getCachedLicenseData();
      let email;
      let deviceId;

      if (
        cachedData &&
        cachedData.email &&
        Date.now() - cachedData.lastValidation <
          this.cacheDurationDays * 24 * 60 * 60 * 1000
      ) {
        email = cachedData.email;
        deviceId = cachedData.deviceId;
        loading.stop();

        const currentTime = await firebaseService.getCurrentInternetTime();
        const expirationDate = new Date(cachedData.expirationDate);
        const daysLeft = Math.ceil(
          (expirationDate - currentTime) / (1000 * 60 * 60 * 24)
        );

        if (daysLeft <= 30) {
          const shouldContinue = await this.showExpirationWarning(
            daysLeft,
            expirationDate
          );
          if (!shouldContinue) {
            return {
              valid: false,
              reason: "Usuário cancelou devido à expiração",
            };
          }
        }

        this.licenseChecked = true;
        return {
          valid: true,
          userData: { ...cachedData, daysLeft },
          deviceId,
        };
      } else {
        if (cachedData && cachedData.email) {
          email = cachedData.email;
          deviceId = cachedData.deviceId || firebaseService.generateDeviceId();
        } else {
          loading.stop();
          email = await this.promptForEmail();
          if (!email) {
            return { valid: false, reason: "Email não fornecido" };
          }
          deviceId = firebaseService.generateDeviceId();
          loading = mostrarLoading("🔍 Verificando licença");
        }

        const validation = await firebaseService.validateLicense(
          email,
          deviceId
        );
        loading.stop();

        if (!validation.valid) {
          return validation;
        }

        const currentTime = await firebaseService.getCurrentInternetTime();
        const expirationDate = new Date(validation.userData.expirationDate);
        const daysLeft = Math.ceil(
          (expirationDate - currentTime) / (1000 * 60 * 60 * 24)
        );

        if (daysLeft <= 30) {
          const shouldContinue = await this.showExpirationWarning(
            daysLeft,
            expirationDate
          );
          if (!shouldContinue) {
            return {
              valid: false,
              reason: "Usuário cancelou devido à expiração",
            };
          }
        }

        await this.saveLicenseDataToCache(
          { ...validation.userData, email },
          deviceId
        );
        this.licenseChecked = true;

        return {
          valid: true,
          userData: { ...validation.userData, daysLeft },
          deviceId,
        };
      }
    } catch (error) {
      console.error("Erro na validação da licença:", error);
      return { valid: false, reason: error.message };
    } finally {
      if (loading && loading.stop) loading.stop();
    }
  }

  async getActiveDevices(email) {
    try {
      const licenseData = await firebaseService.getUserLicense(email);
      if (!licenseData) return null;

      return {
        active: licenseData.devices?.filter((d) => !d.blocked) || [],
        blocked: licenseData.devices?.filter((d) => d.blocked) || [],
        maxDevices: licenseData.maxDevices,
      };
    } catch (error) {
      console.error("Erro ao obter dispositivos:", error);
      return null;
    }
  }

  async closeReadline() {
    this.rl.close();
  }
}

const licenseManagerInstance = new LicenseManager();
module.exports = licenseManagerInstance;
