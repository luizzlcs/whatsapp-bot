const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  getDoc,
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

  async getCurrentInternetTime() {
    try {
      const response = await axios.get("https://time.google.com/api/v1/time", {
        timeout: 8000,
      });
      return new Date(response.data.utc_datetime);
    } catch (error) {
      console.warn(
        "⚠️  Falha ao obter tempo online, usando tempo local com aviso"
      );
      return new Date(); // Fallback para tempo local
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

  normalizeMaxDevices(value) {
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }

    const parsed = parseInt(value);
    if (!isNaN(parsed)) {
      return parsed;
    }

    return 1;
  }

  async validateLicense(email, deviceId) {
    try {
      const currentTime = await this.getCurrentInternetTime();

      // Consulta para encontrar o documento pelo email
      const usersRef = collection(this.db, "botWhatsApp");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return { valid: false, reason: "Email não cadastrado" };
      }

      // Pega o primeiro documento encontrado (email deve ser único)
      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();

      // Normaliza os campos para garantir tipos corretos
      const normalizedData = {
        ...userData,
        blocked: userData.blocked === true || userData.blocked === "true",
        maxDevices: this.normalizeMaxDevices(userData.maxDevices),
        active: userData.active === true || userData.active === "true",
        devices: Array.isArray(userData.devices) ? userData.devices : [],
      };

      // Verificar data de expiração
      const expirationDate = new Date(normalizedData.expirationDate);
      if (currentTime > expirationDate) {
        return { valid: false, reason: "Licença expirada" };
      }

      // Verificar status ativo
      if (!normalizedData.active) {
        return { valid: false, reason: "Licença inativa" };
      }

      // Verificar bloqueio
      if (normalizedData.blocked) {
        return { valid: false, reason: "Licença bloqueada" };
      }

      // Verificar dispositivos
      const isNewDevice = !normalizedData.devices.includes(deviceId);

      if (
        isNewDevice &&
        normalizedData.devices.length >= normalizedData.maxDevices
      ) {
        // Atualizar status para bloqueado
        await updateDoc(userDoc.ref, { blocked: true });
        return { valid: false, reason: "Limite de dispositivos excedido" };
      }

      // Registrar novo dispositivo se necessário
      if (isNewDevice) {
        await updateDoc(userDoc.ref, {
          devices: [...normalizedData.devices, deviceId],
          lastAccess: currentTime.toISOString(),
        });
      } else {
        // Atualizar último acesso
        await updateDoc(userDoc.ref, {
          lastAccess: currentTime.toISOString(),
        });
      }

      return {
        valid: true,
        userData: {
          ...normalizedData,
          expirationDate: expirationDate,
          currentDeviceId: deviceId,
          docId: userDoc.id, // Adiciona o ID do documento
        },
      };
    } catch (error) {
      console.error("Erro na validação de licença:", error);
      return { valid: false, reason: "Erro na validação" };
    }
  }

  async getUserByEmail(email) {
    try {
      const usersRef = collection(this.db, "botWhatsApp");
      const q = query(usersRef, where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        return null;
      }

      return querySnapshot.docs[0].data();
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      return null;
    }
  }
}

module.exports = new FirebaseService();
