const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
const crypto = require('crypto');
const axios = require('axios');

class FirebaseService {
    constructor() {
        this.firebaseConfig = {
            apiKey: "AIzaSyD4G8p3H6J5Z7X9Y8W2Q1R3T4U5I6O7P8",
            authDomain: "seven-manager-cffc7.firebaseapp.com",
            projectId: "seven-manager-cffc7",
            storageBucket: "seven-manager-cffc7.appspot.com",
            messagingSenderId: "123456789012",
            appId: "1:123456789012:web:abcdef1234567890abcdef"
        };

        this.app = initializeApp(this.firebaseConfig);
        this.db = getFirestore(this.app);
    }

    async getCurrentInternetTime() {
        try {
            const response = await axios.get('https://worldtimeapi.org/api/ip', { timeout: 5000 });
            return new Date(response.data.utc_datetime);
        } catch (error) {
            console.warn('⚠️ Falha ao obter tempo online, usando tempo local com aviso');
            return new Date(); // Fallback para tempo local
        }
    }

    generateDeviceId() {
        const hardwareInfo = [
            process.platform,
            process.arch,
            process.env.PROCESSOR_IDENTIFIER || '',
            process.env.COMPUTERNAME || process.env.HOSTNAME || ''
        ].join('|');

        return crypto.createHash('sha256')
            .update(hardwareInfo)
            .digest('hex')
            .substring(0, 32);
    }

    async validateLicense(email, deviceId) {
        try {
            const currentTime = await this.getCurrentInternetTime();
            const userDocRef = doc(this.db, "botWhatsApp", email);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                return { valid: false, reason: "Email não cadastrado" };
            }

            const userData = userDoc.data();
            
            // Verificar data de expiração
            const expirationDate = new Date(userData.expirationDate);
            if (currentTime > expirationDate) {
                return { valid: false, reason: "Licença expirada" };
            }

            // Verificar status ativo
            if (userData.active !== true) {
                return { valid: false, reason: "Licença inativa" };
            }

            // Verificar bloqueio
            if (userData.blocked === true) {
                return { valid: false, reason: "Licença bloqueada" };
            }

            // Verificar dispositivos
            const devices = userData.devices || [];
            const isNewDevice = !devices.includes(deviceId);
            const maxDevices = userData.maxDevices || 1;

            if (isNewDevice && devices.length >= maxDevices) {
                // Atualizar status para bloqueado
                await updateDoc(userDocRef, { blocked: true });
                return { valid: false, reason: "Limite de dispositivos excedido" };
            }

            // Registrar novo dispositivo se necessário
            if (isNewDevice) {
                await updateDoc(userDocRef, {
                    devices: [...devices, deviceId],
                    lastAccess: currentTime.toISOString()
                });
            } else {
                // Atualizar último acesso
                await updateDoc(userDocRef, {
                    lastAccess: currentTime.toISOString()
                });
            }

            return { 
                valid: true, 
                userData: {
                    ...userData,
                    expirationDate: expirationDate,
                    currentDeviceId: deviceId
                }
            };

        } catch (error) {
            console.error('Erro na validação de licença:', error);
            return { valid: false, reason: "Erro na validação" };
        }
    }

    async getUserByEmail(email) {
        try {
            const userDocRef = doc(this.db, "botWhatsApp", email);
            const userDoc = await getDoc(userDocRef);
            
            if (!userDoc.exists()) {
                return null;
            }
            
            return userDoc.data();
        } catch (error) {
            console.error('Erro ao buscar usuário:', error);
            return null;
        }
    }
}

module.exports = new FirebaseService();