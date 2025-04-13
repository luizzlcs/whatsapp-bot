const { initializeApp } = require("firebase/app");
const { getFirestore, doc, getDoc, updateDoc } = require("firebase/firestore");
const crypto = require("crypto");
const axios = require("axios");
const dgram = require("dgram");

class FirebaseService {
  constructor() {
    this.firebaseConfig = {
      apiKey: "AIzaSyD4G8p3H6J5Z7X9Y8W2Q1R3T4U5I6O7P8",
      authDomain: "seven-manager-cffc7.firebaseapp.com",
      projectId: "seven-manager-cffc7",
      storageBucket: "seven-manager-cffc7.appspot.com",
      messagingSenderId: "123456789012",
      appId: "1:123456789012:web:abcdef1234567890abcdef",
    };

    this.app = initializeApp(this.firebaseConfig);
    this.db = getFirestore(this.app);
  }

  // Função para formatar data/hora
  formatarDataHora(date) {
    const dia = String(date.getDate()).padStart(2, "0");
    const mes = String(date.getMonth() + 1).padStart(2, "0");
    const ano = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, "0");
    const minutos = String(date.getMinutes()).padStart(2, "0");
    const segundos = String(date.getSeconds()).padStart(2, "0");

    return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

  // Obtenção de horário com múltiplos fallbacks
  async getCurrentInternetTime() {
    const TIME_SERVICES = [
      {
        name: "WorldTimeAPI",
        url: "https://worldtimeapi.org/api/ip",
        parser: (res) => {
          const date = new Date(res.data.utc_datetime);
          return {
            date,
            formatted: this.formatarDataHora(date),
            source: "WorldTimeAPI",
          };
        },
      },
      {
        name: "TimeAPI.io",
        url: "https://www.timeapi.io/api/Time/current/zone?timeZone=UTC",
        parser: (res) => {
          const date = new Date(res.data.currentDateTime);
          return {
            date,
            formatted: this.formatarDataHora(date),
            source: "TimeAPI.io",
          };
        },
      },
    ];

    // Tentativa com serviços de tempo dedicados
    for (const service of TIME_SERVICES) {
      try {
        const response = await axios.get(service.url, { timeout: 3000 });
        const result = service.parser(response);
        if (result.date instanceof Date && !isNaN(result.date.getTime())) {
          console.log(
            `🕒 ${this.formatarDataHora(date)} | Fonte: ${service.name}`
          );
          return result.date;
        }
      } catch (error) {
        // Silencioso - falha esperada
      }
    }

    // Fallback para servidores HTTP (cabeçalho Date)
    const HTTP_SERVERS = [
      { name: "Google", url: "https://google.com" },
      { name: "Microsoft", url: "https://microsoft.com" },
      { name: "Cloudflare", url: "https://cloudflare.com" },
    ];

    for (const server of HTTP_SERVERS) {
      try {
        const response = await axios.head(server.url, { timeout: 2000 });
        const serverDate = new Date(response.headers["date"]);
        if (!isNaN(serverDate.getTime())) {
          console.log(
            `🕒 ${this.formatarDataHora(date)} | Fonte: ${server.name}`
          );
          return date;
        }
      } catch (error) {
        // Silencioso - falha esperada
      }
    }

    // Fallback para NTP direto
    try {
      const date = await this.getNTPTime();
      // console.log(`🕒 ${this.formatarDataHora(date)} | Fonte: NTP`);
      return date;
    } catch (error) {
      console.warn("⚠️ Usando horário local como fallback");
      return new Date();
    }
  }

  // Implementação do protocolo NTP
  async getNTPTime() {
    return new Promise((resolve, reject) => {
      const client = dgram.createSocket("udp4");
      const ntpServers = [
        "pool.ntp.org",
        "time.nist.gov",
        "br.pool.ntp.org",
        "time.google.com",
      ];
      const ntpPort = 123;
      const ntpData = Buffer.alloc(48);
      ntpData[0] = 0x1b; // Configuração do modo NTP

      let timeout = setTimeout(() => {
        client.close();
        reject(new Error("Timeout NTP"));
      }, 3000);

      client.on("message", (msg) => {
        clearTimeout(timeout);
        client.close();
        const secondsSince1900 = msg.readUInt32BE(40);
        const ntpEpoch = new Date(Date.UTC(1900, 0, 1));
        resolve(new Date(ntpEpoch.getTime() + secondsSince1900 * 1000));
      });

      let attempts = 0;
      const tryNextServer = () => {
        if (attempts >= ntpServers.length) {
          client.close();
          reject(new Error("Todos os servidores NTP falharam"));
          return;
        }

        client.send(
          ntpData,
          0,
          ntpData.length,
          ntpPort,
          ntpServers[attempts++],
          (err) => {
            if (err) tryNextServer();
          }
        );
      };

      tryNextServer();
    });
  }

  // Encontra dispositivo na lista
  findDevice(devicesArray, deviceId) {
    return devicesArray?.find((device) => device.device === deviceId) || null;
  }

  // Gera ID único do dispositivo
  generateDeviceId() {
    const hardwareInfo = [
      process.platform,
      process.arch,
      process.env.PROCESSOR_IDENTIFIER || "",
      process.env.COMPUTERNAME || process.env.HOSTNAME || "",
    ].join("|");

    return crypto.createHash("sha256").update(hardwareInfo).digest("hex");
  }

  // Conta dispositivos ativos
  countActiveDevices(devices) {
    return devices?.filter((d) => !d.blocked).length || 0;
  }

  // Validação completa da licença
  async validateLicense(email, deviceId) {
    try {
      const currentTime = await this.getCurrentInternetTime();
      const userRef = doc(this.db, "botWhatsApp", email);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { valid: false, reason: "Email não cadastrado" };
      }

      const userData = userDoc.data();

      // Verificações básicas da licença
      if (!userData.active) {
        return { valid: false, reason: "Licença inativa" };
      }

      const expirationDate = new Date(userData.expirationDate);
      if (currentTime > expirationDate) {
        return { valid: false, reason: "Licença expirada" };
      }

      // Gerenciamento de dispositivos
      const devices = userData.devices || [];
      const existingDevice = this.findDevice(devices, deviceId);
      const activeDevicesCount = this.countActiveDevices(devices);
      const isNewDevice = !existingDevice;

      // Lógica de controle de dispositivos
      if (isNewDevice) {
        if (activeDevicesCount >= userData.maxDevices) {
          return {
            valid: false,
            reason: `Limite de ${userData.maxDevices} dispositivos ativos atingido`,
          };
        }

        // Adiciona novo dispositivo como ativo
        const newDevice = {
          device: deviceId,
          blocked: false,
          lastAccess: currentTime.toISOString(),
          firstAccess: currentTime.toISOString(),
        };
        devices.push(newDevice);
      } else {
        if (existingDevice.blocked) {
          return {
            valid: false,
            reason: "Dispositivo bloqueado. Limite de dispositivos atingido",
          };
        }

        // Atualiza apenas o último acesso
        existingDevice.lastAccess = currentTime.toISOString();
      }

      // Atualiza no Firestore
      await updateDoc(userRef, {
        devices: devices,
        lastAccess: currentTime.toISOString(),
      });

      return {
        valid: true,
        userData: {
          ...userData,
          expirationDate: expirationDate,
          currentDevice: existingDevice || {
            device: deviceId,
            blocked: false,
            lastAccess: currentTime.toISOString(),
          },
          activeDevices: this.countActiveDevices(devices),
          maxDevices: userData.maxDevices,
        },
      };
    } catch (error) {
      console.error("Erro na validação:", error);
      return { valid: false, reason: "Erro no servidor" };
    }
  }

  // Obtém dados da licença
  async getUserLicense(email) {
    try {
      const userRef = doc(this.db, "botWhatsApp", email);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) return null;

      const userData = userDoc.data();
      return {
        ...userData,
        activeDevices: this.countActiveDevices(userData.devices),
        maxDevices: userData.maxDevices,
      };
    } catch (error) {
      console.error("Erro ao buscar licença:", error);
      return null;
    }
  }
}

module.exports = new FirebaseService();
