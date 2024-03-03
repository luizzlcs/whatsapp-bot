const fs = require('fs');
const path = require('path');
const readline = require('readline');
const firebaseService = require('./firebaseService');
const { formatarDataHora } = require('./utils');

class LicenseManager {
    constructor() {
        this.sessionPath = path.join(process.pkg ? path.dirname(process.execPath) : __dirname, '.wwebjs_auth', 'session', 'user.json');
    }

    async getStoredEmail() {
        try {
            if (fs.existsSync(this.sessionPath)) {
                const data = fs.readFileSync(this.sessionPath, 'utf8');
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
            output: process.stdout
        });

        return new Promise((resolve) => {
            rl.question('📧 Por favor, insira o email cadastrado na sua licença: ', (email) => {
                rl.close();
                resolve(email.trim());
            });
        });
    }

    async validateLicense() {
        try {
            console.log('\n🔍 Verificando licença...');

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

            // 4. Mostrar informações da licença
            const userData = validation.userData;
            console.log('\n✅ Licença válida! Detalhes:');
            console.log(`👤 Nome: ${userData.name}`);
            console.log(`📧 Email: ${userData.email}`);
            console.log(`📅 Expiração: ${formatarDataHora(new Date(userData.expirationDate))}`);
            console.log(`💻 Dispositivos permitidos: ${userData.maxDevices}`);
            console.log(`🔄 Último acesso: ${userData.lastAccess ? formatarDataHora(new Date(userData.lastAccess)) : 'Nunca'}`);
            console.log(`⚙️  Recursos: ${userData.allowedFeatures ? userData.allowedFeatures.join(', ') : 'Todos'}`);
            // 5. Salvar email na sessão se não existir
            if (!await this.getStoredEmail()) {
                this.saveEmailToSession(email);
            }

            return { 
                isValid: true, 
                userData: userData,
                deviceId: deviceId
            };

        } catch (error) {
            console.error('❌ Erro no gerenciador de licenças:', error.message);
            return { isValid: false, reason: error.message };
        }
    }

    saveEmailToSession(email) {
        try {
            const dir = path.dirname(this.sessionPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.sessionPath, JSON.stringify({ email }), 'utf8');
        } catch (error) {
            console.error('⚠️ Não foi possível salvar o email na sessão:', error.message);
        }
    }
}

module.exports = new LicenseManager();