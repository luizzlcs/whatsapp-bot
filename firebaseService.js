const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
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
    return devicesArray.findIndex(device => device.device === deviceId);
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
      const usersRef = collection(this.db, "botWhatsApp");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { valid: false, reason: "Email não cadastrado" };
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Normalização dos dados
      const normalizedData = {
        ...userData,
        maxDevices: this.normalizeMaxDevices(userData.maxDevices),
        active: userData.active === true || userData.active === "true",
        devices: Array.isArray(userData.devices) ? userData.devices : []
      };

      // Verificações básicas
      if (!normalizedData.active) {
        return { valid: false, reason: "Licença inativa" };
      }

      const expirationDate = new Date(normalizedData.expirationDate);
      if (currentTime > expirationDate) {
        return { valid: false, reason: "Licença expirada" };
      }

      // Lógica de dispositivos
      const deviceIndex = this.findDeviceIndex(normalizedData.devices, deviceId);
      const isNewDevice = deviceIndex === -1;
      let currentDevice;

      // Cria cópia do array de dispositivos para manipulação
      const updatedDevices = [...normalizedData.devices];

      if (isNewDevice) {
        // Conta dispositivos não bloqueados
        const activeDevicesCount = updatedDevices.filter(d => !d.blocked).length;
        
        // Novo dispositivo será bloqueado se já tiver atingido o limite
        const willBeBlocked = activeDevicesCount >= normalizedData.maxDevices;
        
        currentDevice = { 
          device: deviceId,
          blocked: willBeBlocked,
          email: email,
          lastAccess: currentTime.toISOString(),
          expirationDate: normalizedData.expirationDate
        };
        
        updatedDevices.push(currentDevice);
      } else {
        // Atualiza apenas o lastAccess para dispositivo existente
        currentDevice = { 
          ...updatedDevices[deviceIndex], 
          lastAccess: currentTime.toISOString() 
        };
        updatedDevices[deviceIndex] = currentDevice;
      }

      // Atualiza no Firebase
      await updateDoc(userDoc.ref, {
        devices: updatedDevices,
        lastAccess: currentTime.toISOString()
      });

      // Verifica se o dispositivo atual está bloqueado
      if (currentDevice.blocked) {
        return { 
          valid: false, 
          reason: `Limite de ${normalizedData.maxDevices} dispositivos ativos atingido. Este dispositivo foi bloqueado.`
        };
      }

      return {
        valid: true,
        userData: {
          ...normalizedData,
          expirationDate: expirationDate,
          currentDevice: currentDevice,
          docId: userDoc.id,
          activeDevicesCount: updatedDevices.filter(d => !d.blocked).length,
          maxDevices: normalizedData.maxDevices
        }
      };

    } catch (error) {
      console.error("Erro na validação:", error);
      return { valid: false, reason: "Erro na validação" };
    }
  }

  normalizeMaxDevices(value) {
    if (value === undefined || value === null) return 1;
    if (typeof value === 'number') return Math.max(1, value);
    const parsed = parseInt(value);
    return isNaN(parsed) ? 1 : Math.max(1, parsed);
  }

  async getUserByEmail(email) {
    try {
      const usersRef = collection(this.db, "botWhatsApp");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) return null;
      
      const userDoc = querySnapshot.docs[0];
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