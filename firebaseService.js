const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  getDoc, // Adicionando a importação que estava faltando
  updateDoc,
  collection,
  query,
  where,
  getDocs,
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

  // Função auxiliar para encontrar dispositivo no array
  findDeviceIndex(devicesArray, deviceId) {
    return devicesArray.findIndex(device => device.deviceId === deviceId);
  }

  async getCurrentInternetTime() {
    try {
      const response = await axios.get("https://worldtimeapi.org/api/ip", {
        timeout: 8000,
      });
      return new Date(response.data.utc_datetime);
    } catch (error) {
      console.warn("⚠️ Falha ao obter tempo online, usando tempo local com aviso");
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
      .digest("hex")
      .substring(0, 32);
  }

  async validateLicense(email, deviceId) {
    try {
      const currentTime = await this.getCurrentInternetTime();
      
      // 1. Buscar usuário pelo email (usando email como ID do documento)
      const userRef = doc(this.db, "botWhatsApp", email);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { valid: false, reason: "Email não cadastrado" };
      }

      const userData = userDoc.data();

      // 2. Verificações básicas
      if (!userData.active) {
        return { valid: false, reason: "Conta inativa" };
      }

      const expirationDate = new Date(userData.expirationDate);
      if (currentTime > expirationDate) {
        return { valid: false, reason: "Licença expirada" };
      }

      // 3. Gerenciamento de dispositivos
      const devices = Array.isArray(userData.devices) ? userData.devices : [];
      const deviceIndex = this.findDeviceIndex(devices, deviceId);
      const isNewDevice = deviceIndex === -1;

      // 4. Atualizar/Criar dispositivo
      const updatedDevices = [...devices];
      let currentDevice;

      if (isNewDevice) {
        // Contar dispositivos ativos
        const activeDevices = devices.filter(d => !d.blocked).length;
        const willBlock = activeDevices >= userData.maxDevices;

        currentDevice = {
          deviceId,
          blocked: willBlock,
          lastAccess: currentTime.toISOString(),
          name: `Dispositivo ${devices.length + 1}`
        };

        updatedDevices.push(currentDevice);
      } else {
        // Atualizar dispositivo existente
        currentDevice = {
          ...devices[deviceIndex],
          lastAccess: currentTime.toISOString()
        };
        updatedDevices[deviceIndex] = currentDevice;
      }

      // 5. Atualizar no Firebase
      await updateDoc(userRef, {
        devices: updatedDevices,
        lastAccess: currentTime.toISOString()
      });

      // 6. Validar acesso
      if (currentDevice.blocked) {
        return { 
          valid: false, 
          reason: `Limite de ${userData.maxDevices} dispositivos ativos atingido.` 
        };
      }

      return {
        valid: true,
        userData: {
          ...userData,
          currentDevice,
          activeDevices: updatedDevices.filter(d => !d.blocked).length,
          maxDevices: userData.maxDevices,
          expirationDate: expirationDate
        }
      };

    } catch (error) {
      console.error("Erro na validação:", error);
      return { valid: false, reason: "Erro no servidor" };
    }
  }

  async getUserByEmail(email) {
    try {
      const userRef = doc(this.db, "botWhatsApp", email);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) return null;
      
      return {
        ...userDoc.data(),
        docId: userDoc.id
      };
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      return null;
    }
  }
}

module.exports = new FirebaseService();