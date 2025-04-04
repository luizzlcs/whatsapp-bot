// Fix para axios em executáveis
if (process.pkg) {
    const path = require('path');
    const axiosPath = path.join(path.dirname(process.execPath), 'node_modules', 'axios');
    try {
        require(axiosPath);
    } catch (e) {
        // Ignore se não encontrar
    }
}

// Solução definitiva para executáveis Windows
if (process.pkg && process.platform === 'win32') {
    // Impedir que o console feche em erros não tratados
    process.on('uncaughtException', (err) => {
        console.error('Erro não tratado:', err);
        console.log('\nPressione ENTER para sair...');
        require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        }).question('', () => process.exit(1));
    });

    // Manter o processo ativo
    const keepAlive = setInterval(() => { }, 1000);
    process.on('exit', () => clearInterval(keepAlive));
}

const path = require('path');
const whatsapp = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const { exec } = require('child_process');
const axios = require('axios');
const readline = require('readline');
const https = require('https');
const crypto = require('crypto');
const dgram = require('dgram');


let tentativasAxios = 0;
const MAX_TENTATIVAS_AXIOS = 0;

axios.interceptors.response.use(
    response => response,
    async error => {
        // Apenas rejeita imediatamente erros de conexão
        return Promise.reject(error);
    }
);


// E o tratamento global de erros para:
process.on('uncaughtException', (err) => {
    console.error('❌ Erro não tratado:', err.message);
    registrarErroDetalhado(err, 'Erro não tratado');
    if (!process.pkg) {
        process.exit(1);
    }
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Promise rejeitada:', err.message);
    registrarErroDetalhado(err, 'Promise rejeitada');
    if (!process.pkg) {
        process.exit(1);
    }
});

// ==================== Configuração especial para executáveis ====================
if (process.pkg) {
    // Garantir que os diretórios necessários existam
    const appDir = path.dirname(process.execPath);
    [path.join(appDir, 'logs'), path.join(appDir, 'config'), path.join(appDir, 'temp')].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    // ==================== Redirecionar stdout e stderr para arquivos quando em executável ====================
    if (process.pkg) {
        // Garantir que os diretórios necessários existam
        const appDir = path.dirname(process.execPath);
        [path.join(appDir, 'logs'), path.join(appDir, 'config'), path.join(appDir, 'temp')].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Configuração mais robusta para redirecionamento de logs
        const originalStdoutWrite = process.stdout.write.bind(process.stdout);
        const originalStderrWrite = process.stderr.write.bind(process.stderr);

        const stdoutLog = fs.createWriteStream(path.join(appDir, 'logs', 'stdout.log'), { flags: 'a' });
        const stderrLog = fs.createWriteStream(path.join(appDir, 'logs', 'stderr.log'), { flags: 'a' });

        process.stdout.write = (chunk, encoding, callback) => {
            try {
                stdoutLog.write(chunk, encoding);
                originalStdoutWrite(chunk, encoding, callback);
            } catch (e) {
                if (e.code !== 'ENOTCONN') {
                    originalStderrWrite(`Erro ao escrever stdout: ${e.message}\n`, 'utf8');
                }
            }
        };

        process.stderr.write = (chunk, encoding, callback) => {
            try {
                stderrLog.write(chunk, encoding);
                originalStderrWrite(chunk, encoding, callback);
            } catch (e) {
                if (e.code !== 'ENOTCONN') {
                    originalStderrWrite(`Erro ao escrever stderr: ${e.message}\n`, 'utf8');
                }
            }
        };

        // Tratamento para evitar ENOTCONN no stdin
        if (process.stdin.isTTY) {
            process.stdin.on('error', (err) => {
                if (err.code !== 'ENOTCONN') {
                    console.error('Erro no stdin:', err);
                }
            });
        }
    }

    // Também manter saída no console
    process.stdout.pipe(process.__stdout || process.stdout);
    process.stderr.pipe(process.__stderr || process.stderr);
}

// Função para aguardar entrada do usuário antes de sair
function aguardarTeclaParaSair(mensagemErro = null) {
    return new Promise((resolve) => {
        if (mensagemErro) {
            console.error(mensagemErro);
        }

        console.log('\n❗ Pressione ENTER para sair...');

        const handleExit = () => {
            try {
                process.exit(0);
            } catch (e) {
                // Se falhar, força saída
                if (typeof process.exit === 'function') {
                    process.exit(0);
                }
            }
        };

        // Configuração específica para executáveis Windows
        if (process.pkg && process.platform === 'win32') {
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question('', () => {
                rl.close();
                handleExit();
            });

            // Tratamento de erro para stdin
            process.stdin.on('error', (err) => {
                if (err.code !== 'ENOTCONN') {
                    console.error('Erro no stdin:', err);
                }
                handleExit();
            });

            // Forçar o stdin a ficar ativo
            try {
                process.stdin.resume();
            } catch (e) {
                // Ignorar erro ENOTCONN
                if (e.code !== 'ENOTCONN') {
                    console.error('Erro ao resumir stdin:', e);
                }
            }
        }
        // Configuração para outros ambientes
        else {
            if (process.stdin.isTTY) {
                try {
                    process.stdin.setRawMode(true);
                } catch (e) {
                    // Ignorar erro se não for possível
                }
            }
            try {
                process.stdin.resume();
                process.stdin.on('data', handleExit);
            } catch (e) {
                // Ignorar erro ENOTCONN
                if (e.code !== 'ENOTCONN') {
                    console.error('Erro no stdin:', e);
                }
                handleExit();
            }
        }

        // Timeout de segurança
        setTimeout(handleExit, 30000);
    });
}

// ==================== Função para registrar erros detalhados ====================
function registrarErroDetalhado(error, contexto = 'Erro não especificado') {
    try {
        const dataHoraErro = new Date().toISOString();
        const mensagemErro = `
===== REGISTRO DE ERRO =====
Data e Hora: ${dataHoraErro}
Contexto: ${contexto}
Mensagem: ${error.message}
Stack Trace:
${error.stack}
===========================
`;

        // Caminho alternativo para executáveis
        const logDir = process.pkg
            ? path.join(path.dirname(process.execPath), 'logs')
            : path.join(__dirname, 'logs');

        // Garantir que o diretório de logs exista
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        // Nome do arquivo de log
        const logFileName = `error_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
        const logPath = path.join(logDir, logFileName);

        // Escrever no arquivo de log
        fs.writeFileSync(logPath, mensagemErro, 'utf8');

        // Também escrever no console para garantir visibilidade
        console.error(mensagemErro);

        return logPath;
    } catch (err) {
        // Fallback: Se tudo falhar, pelo menos mostrar no console
        console.error('Falha ao registrar erro:', err);
        console.error('Erro original:', error);
        return null;
    }
}

// ================= CONFIGURAÇÕES GERAIS =================
const SUBSCRIPTION_END_DATE = new Date('2026-08-03');
const SUBSCRIPTION_DURATION_DAYS = 365;
const SUBSCRIPTION_WARNING_DAYS = 30;

// Configuração global do Axios
axios.defaults.httpsAgent = new https.Agent({
    rejectUnauthorized: false,
    rejectUnauthorized: false,
    timeout: 10000 // 10 segundos de timeout

});

// Estrutura de diretórios
const execDir = process.pkg ? path.dirname(process.execPath) : __dirname;
const logsDir = path.join(execDir, 'logs');
const configDir = path.join(execDir, 'config');
const tempDir = path.join(execDir, 'temp');
const sessionDir = path.join(execDir, '.wwebjs_auth', 'session');
const securityDir = path.join(sessionDir, 'security');

// Função para formatar data no formato DD-MM-YYYY-HH:MM:SS para nome de arquivo
function formatarNomeArquivoData(date) {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const segundos = String(date.getSeconds()).padStart(2, '0');

    return `${dia}-${mes}-${ano}_${horas}-${minutos}-${segundos}`;
}

// Caminhos para arquivos
const numerosPath = path.join(configDir, 'numeros.txt');
const mensagemPath = path.join(configDir, 'mensagem.txt');
const logPath = path.join(logsDir, `log_${formatarNomeArquivoData(new Date())}.txt`);
const qrCodePath = path.join(tempDir, 'qrcode.png');
const timeDataPath = path.join(securityDir, 'time.dat');
const usageDataPath = path.join(securityDir, 'usage.dat');

// =========================== FUNÇÕES AUXILIARES ===========================
function formatarDataHora(date) {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const segundos = String(date.getSeconds()).padStart(2, '0');

    return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

function formatarListaNumeros(numeros) {
    if (numeros.length === 0) return "Nenhum número com falha";

    // Agrupa em linhas de 5 números para melhor visualização
    let resultado = '';
    for (let i = 0; i < numeros.length; i += 5) {
        resultado += numeros.slice(i, i + 5).join(', ') + '\n';
    }
    return resultado;
}

// =========================== SISTEMA DE SEGURANÇA TEMPORAL =================
class TimeSecurity {
    constructor() {
        this.lastKnownDate = null;
    }

    generateMachineHash() {
        const machineId = process.env.COMPUTERNAME ||
            process.env.HOSTNAME ||
            crypto.randomBytes(16).toString('hex');
        return crypto.createHash('sha256').update(machineId).digest();
    }

    async ensureSecurityDirectory() {
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
            console.log(`📁 Diretório de sessão criado: ${sessionDir}`);
        }
        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true });
            console.log(`🔒 Diretório de segurança criado: ${securityDir}`);
        }
    }

    async saveTimeCheckpoint() {
        try {
            await this.ensureSecurityDirectory();

            const timeData = {
                timestamp: Date.now(),
                systemTime: new Date().getTime(),
                envHash: this.createEnvironmentHash()
            };

            const cipher = crypto.createCipheriv('aes-256-gcm', this.generateMachineHash(), Buffer.alloc(12));
            let encrypted = cipher.update(JSON.stringify(timeData), 'utf8', 'hex');
            encrypted += cipher.final('hex');

            fs.writeFileSync(timeDataPath, encrypted);
        } catch (error) {
            registrarErroDetalhado(error, 'Erro ao salvar checkpoint de tempo');
        }
    }

    createEnvironmentHash() {
        return crypto.createHash('sha256')
            .update(process.env.PATH + JSON.stringify(process.versions) + execDir)
            .digest('hex');
    }

    async validateTimeIntegrity() {
        try {
            await this.ensureSecurityDirectory();

            if (!fs.existsSync(timeDataPath)) {
                await this.saveTimeCheckpoint();
                return true;
            }

            const encrypted = fs.readFileSync(timeDataPath, 'utf8');
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.generateMachineHash(), Buffer.alloc(12));
            const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
            const timeData = JSON.parse(decrypted);

            if (timeData.envHash !== this.createEnvironmentHash()) {
                throw new Error('Environment mismatch');
            }

            const currentTime = Date.now();

            if (currentTime < timeData.timestamp) {
                throw new Error('System time reversed');
            }

            this.lastKnownDate = new Date(timeData.systemTime);
            return true;
        } catch (error) {
            registrarErroDetalhado(error, 'Erro na validação de integridade de tempo');
            return false;
        }
    }

    async recordUsage() {
        try {
            await this.ensureSecurityDirectory();

            const today = new Date().toISOString().split('T')[0];
            let usageData = {};

            if (fs.existsSync(usageDataPath)) {
                usageData = JSON.parse(fs.readFileSync(usageDataPath, 'utf8'));
            }

            usageData[today] = (usageData[today] || 0) + 1;
            fs.writeFileSync(usageDataPath, JSON.stringify(usageData));
        } catch (error) {
            registrarErroDetalhado(error, 'Erro ao registrar uso');
        }
    }

    async checkForTampering() {
        try {
            await this.ensureSecurityDirectory();

            if (!fs.existsSync(timeDataPath)) {
                await this.saveTimeCheckpoint();
                return false;
            }

            const encrypted = fs.readFileSync(timeDataPath, 'utf8');
            const decipher = crypto.createDecipheriv('aes-256-gcm', this.generateMachineHash(), Buffer.alloc(12));
            const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
            const timeData = JSON.parse(decrypted);

            if (timeData.envHash !== this.createEnvironmentHash()) {
                return true;
            }

            if (Date.now() < timeData.timestamp) {
                return true;
            }

            return false;
        } catch (error) {
            registrarErroDetalhado(error, 'Erro na verificação de adulteração');
            return true;
        }
    }
}

function criarArquivoExemplo(filePath, conteudo) {
    if (!fs.existsSync(filePath)) {
        try {
            fs.writeFileSync(filePath, conteudo);
            console.log(`📄 Arquivo de exemplo criado: ${filePath}`);
        } catch (err) {
            registrarErroDetalhado(err, `Falha ao criar arquivo de exemplo: ${filePath}`);
        }
    }
}

function writeLog(message) {
    try {
        fs.appendFileSync(logPath, message);
        return true;
    } catch (err) {
        registrarErroDetalhado(err, 'Erro ao escrever log');
        return false;
    }
}
// ================= VERIFICAÇÃO DE TEMPO ONLINE =================
async function getNTPTime() {
    return new Promise((resolve, reject) => {
        const client = dgram.createSocket('udp4');
        const ntpServers = ['pool.ntp.org', 'time.nist.gov', 'br.pool.ntp.org'];
        const ntpPort = 123;

        const ntpData = Buffer.alloc(48);
        ntpData[0] = 0x1B;

        let timeout = setTimeout(() => {
            client.close();
            reject(new Error('Timeout NTP'));
        }, 2000);

        client.on('message', (msg) => {
            clearTimeout(timeout);
            client.close();
            const secondsSince1900 = msg.readUInt32BE(40);
            const ntpEpoch = new Date(Date.UTC(1900, 0, 1));
            resolve(new Date(ntpEpoch.getTime() + (secondsSince1900 * 1000)));
        });

        let attempts = 0;
        const tryNextServer = () => {
            if (attempts >= ntpServers.length) {
                client.close();
                reject(new Error('Todos os servidores NTP falharam'));
                return;
            }

            client.send(ntpData, 0, ntpData.length, ntpPort, ntpServers[attempts++], (err) => {
                if (err) tryNextServer();
            });
        };

        tryNextServer();
    });
}

async function getCurrentInternetTime() {
    const TIME_SERVICES = [
        {
            name: 'WorldTimeAPI',
            url: 'https://worldtimeapi.org/api/ip',
            parser: res => {
                const date = new Date(res.data.utc_datetime);
                return {
                    date,
                    formatted: formatarDataHora(date),
                    source: 'WorldTimeAPI'
                };
            }
        },
        {
            name: 'TimeAPI.io',
            url: 'https://www.timeapi.io/api/Time/current/zone?timeZone=UTC',
            parser: res => {
                const date = new Date(res.data.currentDateTime);
                return {
                    date,
                    formatted: formatarDataHora(date),
                    source: 'TimeAPI.io'
                };
            }
        },
        {
            name: 'Google Time',
            url: 'https://time.google.com/api/v1/time',
            parser: res => {
                const date = new Date(res.data.currentDateTime);
                return {
                    date,
                    formatted: formatarDataHora(date),
                    source: 'Google Time'
                };
            }
        }
    ];

    for (const service of TIME_SERVICES) {
        try {
            const response = await axios.get(service.url, { timeout: 5000 });
            const result = service.parser(response);
            if (result.date instanceof Date && !isNaN(result.date.getTime())) {
                console.log(`✅ Horário obtido de ${service.name}: ${result.formatted}`);
                return result;
            }
        } catch (error) {
            // console.warn(`⚠️ Falha com ${service.name}: ${error.message}`);
        }
    }

    const HTTP_SERVERS = [
        { name: 'Google', url: 'https://google.com' },
        { name: 'Microsoft', url: 'https://microsoft.com' },
        { name: 'AWS', url: 'https://aws.amazon.com' }
    ];

    for (const server of HTTP_SERVERS) {
        try {
            const response = await axios.head(server.url, { timeout: 1500 });
            const serverDate = new Date(response.headers['date']);
            if (!isNaN(serverDate.getTime())) {
                const formatted = formatarDataHora(serverDate);
                // console.log(`⏰ Consultando hora e data de ${server.name}: ${formatted}`);
                return {
                    date: serverDate,
                    formatted,
                    source: server.name
                };
            }
        } catch (error) {
            // console.warn(`⚠️ Falha no HEAD para ${server.name}`);
        }
    }

    try {
        const ntpTime = await getNTPTime();
        const formatted = formatarDataHora(ntpTime);
        console.log(`⏰ Usando NTP direto: ${formatted}`);
        return {
            date: ntpTime,
            formatted,
            source: 'NTP'
        };
    } catch (error) {
        console.warn('⚠️ Falha no NTP direto:', error.message);
    }

    throw new Error('Todos os métodos de verificação de tempo falharam');
}

// ================= VERIFICAÇÃO DE ASSINATURA =================
async function checkSubscriptionStatus(timeSecurity) {
    try {
        console.log('\n⏳ Aguarde, verificando Assinatura...\n');
        let currentTime;
        let timeSource = 'Sistema Local';
        let formattedTime = '';

        try {
            const timeResult = await getCurrentInternetTime();
            currentTime = timeResult.date;
            formattedTime = timeResult.formatted;
            timeSource = timeResult.source;
            await timeSecurity.saveTimeCheckpoint();
        } catch (error) {
            console.warn('⚠️ Usando verificação de tempo offline');
            if (await timeSecurity.checkForTampering()) {
                throw new Error('Possível adulteração temporal detectada');
            }

            currentTime = timeSecurity.lastKnownDate || new Date();
            formattedTime = formatarDataHora(currentTime);
        }

        const warningDate = new Date(SUBSCRIPTION_END_DATE);
        warningDate.setDate(warningDate.getDate() - SUBSCRIPTION_WARNING_DAYS);

        const diasRestantes = Math.ceil((SUBSCRIPTION_END_DATE - currentTime) / (1000 * 60 * 60 * 24));

        console.log(`
📅 Verificação de Assinatura:
        • Data atual: ${formattedTime} (Fonte: ${timeSource})
        • Data de expiração: ${formatarDataHora(SUBSCRIPTION_END_DATE)}
        • Dias restantes: ${diasRestantes}`);

        if (currentTime > SUBSCRIPTION_END_DATE) {
            console.log('\n❌ ASSINATURA EXPIRADA ❌');
            return { status: false, expired: true };
        }

        return {
            status: true,
            warning: currentTime >= warningDate,
            diasRestantes: diasRestantes
        };
    } catch (error) {
        console.error('Erro na verificação de assinatura:', error.message);
        writeLog(`\n=== ERRO VERIFICAÇÃO ===\n${error.message}\n==================\n`);
        return { status: false, error: error.message };
    }
}
// ================= FUNÇÕES DE CONFIGURAÇÃO =================
function criarDiretoriosNecessarios() {
    const diretoriosNecessarios = [logsDir, configDir, tempDir];
    diretoriosNecessarios.forEach(dir => {
        if (!fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Diretório criado: ${dir}`);
            } catch (err) {
                registrarErroDetalhado(err, `Falha ao criar diretório: ${dir}`);
            }
        }
    });
}

// ================= CONFIGURAÇÃO DO WHATSAPP CLIENT =================
function configurarWhatsAppClient() {
    let chromePath;
    if (process.platform === 'win32') {
        const paths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        chromePath = paths.find(fs.existsSync);
    } else if (process.platform === 'darwin') {
        chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
        chromePath = '/usr/bin/google-chrome';
    }

    console.log(`\n=== BOT DE WHATSAPP ===`);
    console.log(`📘 Usando navegador Chrome em: ${chromePath || "Caminho padrão"}`);

    return new whatsapp.Client({
        authStrategy: new whatsapp.LocalAuth({ dataPath: path.join(execDir, '.wwebjs_auth') }),
        puppeteer: {
            headless: false,
            executablePath: chromePath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-connection-testing',  // Previne problemas de conexão
                '--disable-renderer-backgrounding'  // Mantém a conexão ativa
            ],
            timeout: 60000  // Aumenta o timeout para 60 segundos
        },
        takeoverOnConflict: true,  // Permite recuperar sessões existentes
        takeoverTimeoutMs: 20000  // Tempo para tentar recuperar a sessão
    });
}

// ================= ENVIO DE MENSAGENS =================
async function enviarMensagens(client) {
    try {
        if (!fs.existsSync(numerosPath) || !fs.existsSync(mensagemPath)) {
            throw new Error('Arquivos de configuração não encontrados');
        }

        const numeros = fs.readFileSync(numerosPath, 'utf8')
            .split('\n')
            .map(n => n.trim())
            .filter(n => n && !n.startsWith('//'))
            .map(n => n.replace(/\D/g, '') + "@c.us");

        if (numeros.length === 0) throw new Error('Nenhum número válido encontrado');

        const mensagem = fs.readFileSync(mensagemPath, 'utf8');
        if (!mensagem.trim()) throw new Error('Mensagem vazia');

        const inicioProcesso = new Date();
        
        // Cabeçalho do log formatado conforme solicitado
        let logContent = `
📅 Verificação de Assinatura:
        • Data atual: ${formatarDataHora(inicioProcesso)} (Fonte: Google)
        • Data de expiração: ${formatarDataHora(SUBSCRIPTION_END_DATE)}
        • Dias restantes: ${Math.ceil((SUBSCRIPTION_END_DATE - inicioProcesso) / (1000 * 60 * 60 * 24))}
=== BOT DE WHATSAPP ===

🔴 Iniciando WhatsApp Bot...
✅ Bot do WhatsApp está pronto para enviar mensagens!
🔍 Verificando arquivos de configuração...
📄 Lendo números de: ${numerosPath}
📌 Encontrados ${numeros.length} números para envio.
📄 Lendo mensagem de: ${mensagemPath}
📌 Mensagem carregada (${mensagem.length} caracteres).
📤 Iniciando envio para ${numeros.length} números...
${'='.repeat(50)}
📊 PROGRESSO DE ENVIO:
${'='.repeat(50)}
`;

        writeLog(logContent);

        console.log(`\n🔍 Verificando arquivos de configuração...`);
        console.log(`📄 Lendo números de: ${numerosPath}`);
        console.log(`📌 Encontrados ${numeros.length} números para envio.`);
        console.log(`📄 Lendo mensagem de: ${mensagemPath}`);
        console.log(`📌 Mensagem carregada (${mensagem.length} caracteres).\n`);

        console.log(`📤 Iniciando envio para ${numeros.length} números...`);
        console.log(`\n${'='.repeat(50)}`);
        console.log(`📊 PROGRESSO DE ENVIO:`);
        console.log(`${'='.repeat(50)}\n`);

        let enviadas = 0, falhas = 0;
        let logDetails = '';
        let ultimaAtualizacao = Date.now();
        let temposEnvio = [];
        let numerosComFalha = [];

        // Função para formatar o tempo de maneira amigável
        const formatarTempo = (segundos) => {
            if (segundos < 60) {
                return `${Math.round(segundos)} segundos`;
            } else if (segundos < 3600) {
                const minutos = Math.floor(segundos / 60);
                const segs = Math.round(segundos % 60);
                return `${minutos} min ${segs} s`;
            } else {
                const horas = Math.floor(segundos / 3600);
                const minutos = Math.floor((segundos % 3600) / 60);
                return `${horas} h ${minutos} min`;
            }
        };

        // Função para atualizar o progresso no console
        const atualizarProgresso = (atual, total, tempoDecorrido, temposEnvio) => {
            const agora = Date.now();
            // Atualiza no máximo a cada 500ms para não sobrecarregar o console
            if (agora - ultimaAtualizacao < 500 && atual < total) return;
            ultimaAtualizacao = agora;

            // Calcula médias e estimativas
            const percentualConcluido = (atual / total * 100).toFixed(1);
            const percentualRestante = (100 - percentualConcluido).toFixed(1);

            // Calcula tempo médio por mensagem e estimativa de tempo restante
            let tempoMedioPorMsg = tempoDecorrido / atual;
            if (isNaN(tempoMedioPorMsg)) tempoMedioPorMsg = 0;

            // Usar média móvel dos últimos envios para estimativa mais precisa
            let tempoEstimadoRestante = 0;
            if (temposEnvio.length > 0) {
                // Usa os últimos 5 tempos de envio ou todos disponíveis
                const amostras = temposEnvio.slice(-5);
                const mediaMaisRecente = amostras.reduce((a, b) => a + b, 0) / amostras.length;
                tempoEstimadoRestante = mediaMaisRecente * (total - atual);
            } else {
                tempoEstimadoRestante = tempoMedioPorMsg * (total - atual);
            }

            // Limpa linhas anteriores (3 linhas de progresso)
            process.stdout.write('\x1B[3A\x1B[0J');

            // Barra de progresso visual
            const larguraBarra = 30;
            const barraCompleta = Math.round((atual / total) * larguraBarra);
            const barraProgresso = '█'.repeat(barraCompleta) + '░'.repeat(larguraBarra - barraCompleta);

            console.log(`🔄 Progresso: ${barraProgresso} ${percentualConcluido}% concluído (${percentualRestante}% restante)`);
            console.log(`📱 Mensagens: ${atual}/${total} enviadas | ✅ ${enviadas} com sucesso | ❌ ${falhas} falhas`);
            console.log(`⏱️ Tempo: ${formatarTempo(tempoDecorrido)} decorrido | ~${formatarTempo(tempoEstimadoRestante)} restante`);
        };

        // Exibir progresso inicial
        console.log('\n\n'); // Espaço para as 3 linhas de progresso
        atualizarProgresso(0, numeros.length, 0, []);

        for (let i = 0; i < numeros.length; i++) {
            const numero = numeros[i];
            const numeroFormatado = numero.replace('@c.us', '');
            const inicioEnvio = Date.now();

            try {
                const contato = await client.getNumberId(numero);
                if (!contato) {
                    falhas++;
                    numerosComFalha.push(numeroFormatado); // Adiciona o número à lista de falha
                    logDetails += `--- DETALHES DO ENVIO ---\nData: ${formatarDataHora(new Date()).split(' ')[0]}\nHora: ${formatarDataHora(new Date()).split(' ')[1]}\nNumero: ${numeroFormatado}\nStatus: Não está no WhatsApp\n---\n`;
                } else {
                    await client.sendMessage(contato._serialized, mensagem);
                    enviadas++;
                    logDetails += `--- DETALHES DO ENVIO ---\nData: ${formatarDataHora(new Date()).split(' ')[0]}\nHora: ${formatarDataHora(new Date()).split(' ')[1]}\nNumero: ${numeroFormatado}\nStatus: Enviado com sucesso\n---\n`;
                }

                // Registra o tempo que levou para enviar esta mensagem
                const tempoEnvio = (Date.now() - inicioEnvio) / 1000;
                temposEnvio.push(tempoEnvio);

                // Atualiza o progresso
                const tempoDecorrido = (Date.now() - inicioProcesso) / 1000;
                atualizarProgresso(i + 1, numeros.length, tempoDecorrido, temposEnvio);

                // Pequeno delay entre os envios para evitar bloqueios
                await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

            } catch (error) {
                falhas++;
                numerosComFalha.push(numeroFormatado); // Adiciona o número à lista de falhas
                logDetails += `--- DETALHES DO ENVIO ---\nData: ${formatarDataHora(new Date()).split(' ')[0]}\nHora: ${formatarDataHora(new Date()).split(' ')[1]}\nNumero: ${numeroFormatado}\nStatus: Falha - ${error.message}\n---\n`;

                // Atualiza o progresso mesmo em caso de erro
                const tempoDecorrido = (Date.now() - inicioProcesso) / 1000;
                atualizarProgresso(i + 1, numeros.length, tempoDecorrido, temposEnvio);
            }
        }

        const fimProcesso = new Date();
        const tempoExecucao = (fimProcesso - inicioProcesso) / 1000;
        const tempoFormatado = formatarTempo(tempoExecucao);
        const velocidadeMedia = numeros.length / tempoExecucao;

        // Adiciona o resumo ao conteúdo do log
        logContent += `
🔄 Progresso: ██████████████████████████████ 100.0% concluído (0.0% restante)
📱 Mensagens: ${numeros.length}/${numeros.length} enviadas | ✅ ${enviadas} com sucesso | ❌ ${falhas} falhas
⏱️ Tempo: ${formatarTempo(tempoExecucao)} decorrido | ~0 segundos restante
${'='.repeat(50)}
📋 RESUMO DO ENVIO:
${'='.repeat(50)}
✅ Total de números processados: ${numeros.length}
✅ Total de mensagens enviadas com sucesso: ${enviadas} (${(enviadas / numeros.length * 100).toFixed(1)}%)
❌ Total de mensagens não enviadas: ${falhas} (${(falhas / numeros.length * 100).toFixed(1)}%)
⏱️ Tempo total de execução: ${tempoFormatado}
📄 Log completo salvo em: ${logPath}
📊 Velocidade média: ${velocidadeMedia.toFixed(2)} mensagens/segundo

=== ⚠️  NÚMEROS COM FALHA DE ENVIO ===
${numerosComFalha.join('\n')}
===============================

 🔄 O programa continuará em execução para manter a sessão do WhatsApp ativa.
 🛑 Para encerrar, pressione ENTER ou feche esta janela.
 💡 Para enviar mais mensagens, edite os arquivos de configuração e reinicie o programa.
`;

        // Escreve todo o conteúdo no arquivo de log
        fs.writeFileSync(logPath, logContent, 'utf8');

        console.log(`\n${'='.repeat(50)}`);
        console.log(`📋 RESUMO DO ENVIO:`);
        console.log(`${'='.repeat(50)}`);
        console.log(`✅ Total de números processados: ${numeros.length}`);
        console.log(`✅ Total de mensagens enviadas com sucesso: ${enviadas} (${(enviadas / numeros.length * 100).toFixed(1)}%)`);
        console.log(`❌ Total de mensagens não enviadas: ${falhas} (${(falhas / numeros.length * 100).toFixed(1)}%)`);
        console.log(`⏱️ Tempo total de execução: ${tempoFormatado}`);
        console.log(`📄 Log completo salvo em: ${logPath}`);
        console.log(`📊 Velocidade média: ${velocidadeMedia.toFixed(2)} mensagens/segundo`);

        console.log(`\n=== ⚠️  NÚMEROS COM FALHA DE ENVIO ===`);
        console.log(numerosComFalha.join('\n'));
        console.log(`===============================`);

        console.log(`\n 🔄 O programa continuará em execução para manter a sessão do WhatsApp ativa.`);
        console.log(` 🛑 Para encerrar, pressione ENTER ou feche esta janela.`);
        console.log(` 💡 Para enviar mais mensagens, edite os arquivos de configuração e reinicie o programa.\n`);

        // Aguardar o pressionamento da tecla ENTER e encerrar o programa
        await aguardarTeclaParaSair();

        // Encerrar a sessão do WhatsApp Web
        await client.destroy();

        // Manter o programa em execução e aguardar entrada do usuário
        await new Promise(() => { });

    } catch (error) {
        console.error(`\n❌ ERRO: ${error.message}`);
        writeLog(`\n=== ERRO ===\n${error.stack}\n`);
        throw error;
    }
}


// =========================== FUNÇÃO PRINCIPAL MODIFICADA ===========================
async function main() {
    // SOLUÇÃO ESSENCIAL 
    if (process.pkg) {
        const handleStreamError = (err) => {
            if (err.code !== 'ENOTCONN') {  // Ignora apenas ENOTCONN
                console.error('Erro no stream:', err);
            }
        };
        process.stdin.on('error', handleStreamError);
        process.stdout.on('error', handleStreamError);
        process.stderr.on('error', handleStreamError);
    }

    let client = null;

    try {
        // Configurações iniciais (mantendo suas verificações originais)
        console.log(`Modo de execução: ${process.pkg ? 'Executável' : 'Script'}`);
        console.log(`Diretório de execução: ${process.pkg ? path.dirname(process.execPath) : __dirname}`);

        // Configuração especial para executáveis Windows (mantida do original)
        if (process.pkg && process.platform === 'win32') {
            process.stdin.on('data', () => { });
            process.stdin.resume();
        }

        // Verificação de diretórios (versão mais completa)
        const timeSecurity = new TimeSecurity();
        criarDiretoriosNecessarios();
        criarArquivoExemplo(numerosPath, "5511999999999\n5511888888888\n// Um número por linha");
        criarArquivoExemplo(mensagemPath, "Olá! Esta é uma mensagem de exemplo.");

        // Verificação de assinatura (com aviso de expiração)
        const subscription = await checkSubscriptionStatus(timeSecurity);
        if (!subscription.status) {
            await aguardarTeclaParaSair('Não foi possível verificar a assinatura');
            return;
        }

        if (subscription.warning) {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const resposta = await new Promise(resolve => {
                rl.question('📤 Assinatura próxima do vencimento. Deseja continuar? (s/n): ', resolve);
            });
            rl.close();

            if (resposta.toLowerCase() !== 's') {
                await aguardarTeclaParaSair('Operação cancelada pelo usuário');
                return;
            }
        }

        // Inicialização do client (versão otimizada)
        client = configurarWhatsAppClient();
        console.log('\n🔴 Iniciando WhatsApp Bot...');

        // Configuração de eventos (mantendo tratamento de erros)
        client.on('qr', qr => {
            console.log('🔎 QR Code gerado, escaneie para conectar');
            qrcode.toFile(qrCodePath, qr, { errorCorrectionLevel: 'H' }, (err) => {
                if (err) {
                    console.error('❌ Erro ao gerar QR Code:', err.message);
                    return;
                }
                try {
                    if (process.platform === 'win32') exec(`start "" "${qrCodePath}"`);
                    else if (process.platform === 'darwin') exec(`open "${qrCodePath}"`);
                    else exec(`xdg-open "${qrCodePath}"`);
                } catch (err) {
                    console.log(`ℹ️ QR Code salvo em: ${qrCodePath}`);
                }
            });
        });

        client.on('ready', async () => {
            console.log('✅ Bot do WhatsApp está pronto para enviar mensagens!');
            try {
                await timeSecurity.recordUsage();
                await enviarMensagens(client);
                console.log('\n🟢 Processo de envio concluído!');
                console.log('ℹ️  O programa continuará em execução.');
                await timeSecurity.saveTimeCheckpoint();
                await new Promise(() => { });
            } catch (error) {
                registrarErroDetalhado(error, 'Erro durante envio');
                await aguardarTeclaParaSair('Erro durante o envio de mensagens');
            }
        });

        client.on('disconnected', async (reason) => {
            console.error('❌ Desconectado:', reason);
            try {
                await client.destroy();
                await client.initialize();
            } catch (error) {
                registrarErroDetalhado(error, 'Falha na reconexão');
                await aguardarTeclaParaSair('Falha na conexão com o WhatsApp');
            }
        });

        await client.initialize();

    } catch (err) {
        registrarErroDetalhado(err, 'Erro fatal na inicialização');
        await aguardarTeclaParaSair('Erro na inicialização: ' + err.message);
    }
}

// Remover process.stdin.resume() existente
main().catch(err => {
    registrarErroDetalhado(err, 'Erro no processo principal');
    aguardarTeclaParaSair('Erro crítico no processo principal');
});