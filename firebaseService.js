const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  getDoc,
  updateDoc
} = require("firebase/firestore");
const crypto = require("crypto");
const axios = require("axios");

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

  findDevice(devicesArray, deviceId) {
    return devicesArray.find(device => device.device === deviceId);
  }

  async getCurrentInternetTime() {
    try {
      const response = await axios.get("https://worldtimeapi.org/api/ip", {
        timeout: 5000
      });
      return new Date(response.data.utc_datetime);
    } catch (error) {
      console.warn("⚠️ Usando horário local como fallback");
      return new Date();
    }
  }

  generateDeviceId() {
    const hardwareInfo = [
      process.platform,
      process.arch,
      process.env.PROCESSOR_IDENTIFIER || "",
      process.env.COMPUTERNAME || process.env.HOSTNAME || "",
    ].join("|");

    return crypto
      .createHash("sha256")
      .update(hardwareInfo)
      .digest("hex");
  }

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
      const isNewDevice = !existingDevice;

      // Atualizar/Criar registro do dispositivo
      const updatedDevices = [...devices];
      let currentDevice;

      if (isNewDevice) {
        // Verificar limite de dispositivos
        const activeDevices = devices.filter(d => !d.blocked).length;
        if (activeDevices >= userData.maxDevices) {
          return { 
            valid: false, 
            reason: `Limite de ${userData.maxDevices} dispositivos atingido` 
          };
        }

        currentDevice = {
          device: deviceId,
          blocked: false,
          lastAccess: currentTime.toISOString()
        };
        updatedDevices.push(currentDevice);
      } else {
        currentDevice = {
          ...existingDevice,
          lastAccess: currentTime.toISOString()
        };
        const deviceIndex = devices.findIndex(d => d.device === deviceId);
        updatedDevices[deviceIndex] = currentDevice;
      }

      // Atualizar no Firestore
      await updateDoc(userRef, {
        devices: updatedDevices,
        lastAccess: currentTime.toISOString()
      });

      return {
        valid: true,
        userData: {
          ...userData,
          expirationDate: expirationDate,
          currentDevice: currentDevice
        }
      };

    } catch (error) {
      console.error("Erro na validação:", error);
      return { valid: false, reason: "Erro no servidor" };
    }
  }

  async getUserLicense(email) {
    try {
      const userRef = doc(this.db, "botWhatsApp", email);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return null;
      
      return userDoc.data();
    } catch (error) {
      console.error("Erro ao buscar licença:", error);
      return null;
    }
  }
}

module.exports = new FirebaseService();