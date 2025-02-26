const path = require('path');  // Módulo nativo do Node.js
const whatsapp = require('whatsapp-web.js');  // Importando o pacote inteiro
const qrcode = require('qrcode');  // Módulo externo
const fs = require('fs');  // Módulo nativo do Node.js
const { exec } = require('child_process');  // Para abrir o QR code sem o módulo 'open'

// Obtém o diretório onde o executável está sendo executado
const execDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// Estrutura de diretórios externa ao executável
const logsDir = path.join(execDir, 'logs');
const configDir = path.join(execDir, 'config');
const tempDir = path.join(execDir, 'temp');

// Criar diretórios necessários se não existirem
const diretoriosNecessarios = [logsDir, configDir, tempDir];
diretoriosNecessarios.forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`📁 Diretório criado: ${dir}`);
        } catch (err) {
            console.error(`⚠️ Não foi possível criar diretório: ${dir}`, err);
        }
    }
});

// Caminhos para arquivos externos ao executável
const numerosPath = path.join(configDir, 'numeros.txt');
const mensagemPath = path.join(configDir, 'mensagem.txt');
const logPath = path.join(logsDir, `log_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`);
const qrCodePath = path.join(tempDir, 'qrcode.png');

// Verifica e cria arquivos de exemplo se não existirem
function criarArquivoExemplo(filePath, conteudo) {
    if (!fs.existsSync(filePath)) {
        try {
            fs.writeFileSync(filePath, conteudo);
            console.log(`📄 Arquivo de exemplo criado: ${filePath}`);
        } catch (err) {
            console.error(`⚠️ Não foi possível criar arquivo de exemplo: ${filePath}`, err);
        }
    }
}

// Criar arquivos de exemplo se não existirem
criarArquivoExemplo(numerosPath, "5511999999999\n5511888888888\n// Adicione um número de telefone por linha (sem espaços ou caracteres especiais)");
criarArquivoExemplo(mensagemPath, "Olá! Esta é uma mensagem de exemplo.\nModifique este arquivo com sua mensagem real.\n\nAtenciosamente,\nSeu Nome");

process.on('uncaughtException', (err) => {
    console.error('❌ Erro inesperado:', err);
    writeLog(`\n=== ERRO CRÍTICO ===\n${err.message}\n${err.stack}\n==================\n`);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Rejeição não tratada:', err);
    writeLog(`\n=== REJEIÇÃO NÃO TRATADA ===\n${err.message}\n${err.stack}\n==================\n`);
    process.exit(1);
});

const { Client, LocalAuth } = whatsapp;  // Desestruturação

// Definindo o caminho do Chrome com base no sistema operacional
let chromePath;
if (process.platform === 'win32') {
    // Windows - verificando ambos os caminhos comuns
    const path1 = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const path2 = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
    
    if (fs.existsSync(path1)) {
        chromePath = path1;
    } else if (fs.existsSync(path2)) {
        chromePath = path2;
    }
} else if (process.platform === 'darwin') {
    // macOS
    chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
} else {
    // Linux
    chromePath = '/usr/bin/google-chrome';
}

console.log(`\n=== BOT DE WHATSAPP ===`);
console.log(`🔍 Usando navegador Chrome em: ${chromePath || "Caminho padrão"}`);
console.log(`📂 Diretório principal: ${execDir}`);
console.log(`📄 Arquivo de números: ${numerosPath}`);
console.log(`📄 Arquivo de mensagem: ${mensagemPath}`);
console.log(`📝 Logs serão salvos em: ${logsDir}`);

// Diretório personalizado para a sessão do WhatsApp
const sessionDir = path.join(execDir, '.wwebjs_auth');

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: sessionDir  // Define um diretório externo para a sessão
    }),
    puppeteer: {
        headless: false,
        executablePath: chromePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Função de ajuda para escrever logs com segurança
function writeLog(message) {
    try {
        fs.appendFileSync(logPath, message);
        return true;
    } catch (err) {
        console.error('⚠️ Erro ao escrever log:', err.message);
        return false;
    }
}

console.log("\n🛑 Iniciando WhatsApp Bot... aguarde...");
client.on('qr', qr => {
    console.log("🔎 Escaneie o QR Code abaixo para conectar:");

    qrcode.toFile(qrCodePath, qr, {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.92
    }, (err) => {
        if (err) {
            console.error('⚠ Erro ao gerar o QR Code:', err);
        } else {
            console.log(`🟢 QR Code gerado como "${qrCodePath}". Abrindo a imagem para escanear...`);
            
            // Abrindo o QR code usando o método nativo do sistema operacional
            try {
                if (process.platform === 'win32') {
                    exec(`start "" "${qrCodePath}"`);
                } else if (process.platform === 'darwin') {
                    exec(`open "${qrCodePath}"`);
                } else {
                    exec(`xdg-open "${qrCodePath}"`);
                }
            } catch (error) {
                console.log(`⚠️ Não foi possível abrir o QR Code automaticamente. Por favor, abra o arquivo "${qrCodePath}" manualmente.`);
            }
        }
    });
});

client.on('ready', async () => {
    console.log("✅ Bot do WhatsApp está pronto para enviar mensagens!");

    try {
        // Recarregar os arquivos a cada execução para obter as versões mais recentes
        console.log(`📂 Verificando arquivos de configuração...`);
        
        // Verificando se os arquivos existem antes de tentar lê-los
        if (!fs.existsSync(numerosPath)) {
            throw new Error(`Arquivo de números não encontrado em: ${numerosPath}. Por favor, crie o arquivo com um número por linha.`);
        }
        
        if (!fs.existsSync(mensagemPath)) {
            throw new Error(`Arquivo de mensagem não encontrado em: ${mensagemPath}. Por favor, crie o arquivo com sua mensagem.`);
        }

        // Lê os números de telefone do arquivo externo
        console.log(`📱 Lendo números de: ${numerosPath}`);
        const conteudoNumeros = fs.readFileSync(numerosPath, 'utf8');
        
        // Filtra linhas comentadas e vazias
        const numeros = conteudoNumeros.split('\n')
            .map(n => n.trim())
            .filter(n => n !== '' && !n.startsWith('//'))
            .map(n => {
                // Formata o número para o formato do WhatsApp
                let numero = n.replace(/\D/g, ''); // Remove não-dígitos
                return numero + "@c.us";
            });

        if (numeros.length === 0) {
            throw new Error(`Arquivo de números em ${numerosPath} está vazio ou não contém números válidos.`);
        }
        console.log(`📱 Encontrados ${numeros.length} números para envio.`);

        // Lê a mensagem do arquivo externo
        console.log(`💬 Lendo mensagem de: ${mensagemPath}`);
        const mensagem = fs.readFileSync(mensagemPath, 'utf8');
        if (!mensagem || mensagem.trim() === '') {
            throw new Error(`Arquivo de mensagem em ${mensagemPath} está vazio.`);
        }
        console.log(`💬 Mensagem carregada (${mensagem.length} caracteres).`);

        // Iniciar o arquivo de log com cabeçalho
        const inicioLog = `=== REGISTRO DE ENVIO DE MENSAGENS ===\nIniciado em: ${new Date().toLocaleString('pt-BR')}\nQuantidade de números: ${numeros.length}\n\n`;
        writeLog(inicioLog);

        let mensagensEnviadas = 0;
        let mensagensNaoEnviadas = 0;

        console.log(`\n📤 Iniciando envio para ${numeros.length} números...`);
        writeLog(`\n--- DETALHES DO ENVIO ---\n`);

        for (let i = 0; i < numeros.length; i++) {
            const numero = numeros[i];
            console.log(`📤 Processando ${i+1}/${numeros.length}: ${numero}`);
            
            if (numero) {
                try {
                    const contato = await client.getNumberId(numero);
                    if (contato) {
                        await client.sendMessage(contato._serialized, mensagem);
                        console.log(`✅ Mensagem enviada para ${numero}`);

                        const dataHora = new Date();
                        const logData = `\nDate: ${dataHora.toLocaleDateString('pt-BR')}\nTime: ${dataHora.toLocaleTimeString('pt-BR')}\nPhone Number: ${numero}\nStatus: Enviado com sucesso\n---\n`;
                        writeLog(logData);
                        mensagensEnviadas++;
                    } else {
                        console.log(`❌ O número ${numero} NÃO possui WhatsApp.`);
                        const logData = `\nDate: ${new Date().toLocaleDateString('pt-BR')}\nTime: ${new Date().toLocaleTimeString('pt-BR')}\nPhone Number: ${numero}\nStatus: Não possui WhatsApp\n---\n`;
                        writeLog(logData);
                        mensagensNaoEnviadas++;
                    }
                } catch (erro) {
                    console.log(`❌ Erro ao enviar para ${numero}: ${erro.message}`);
                    const logData = `\nDate: ${new Date().toLocaleDateString('pt-BR')}\nTime: ${new Date().toLocaleTimeString('pt-BR')}\nPhone Number: ${numero}\nStatus: Erro - ${erro.message}\n---\n`;
                    writeLog(logData);
                    mensagensNaoEnviadas++;
                }
                
                // Adiciona um pequeno delay entre mensagens para evitar bloqueios
                await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
            }
        }

        const resumoLog = `\n=== RESUMO DO ENVIO ===\nTotal de números processados: ${numeros.length}\nTotal de mensagens enviadas: ${mensagensEnviadas}\nTotal de mensagens não enviadas: ${mensagensNaoEnviadas}\nFinalizado em: ${new Date().toLocaleString('pt-BR')}\n===============================\n`;
        writeLog(resumoLog);

        console.log("\n📊 RESUMO DO ENVIO:");
        console.log(`📱 Total de números processados: ${numeros.length}`);
        console.log(`✅ Total de mensagens enviadas: ${mensagensEnviadas}`);
        console.log(`❌ Total de mensagens não enviadas: ${mensagensNaoEnviadas}`);
        console.log(`📝 Log completo salvo em: ${logPath}`);
        console.log("✅ Processo de envio concluído!");

    } catch (error) {
        console.error(`\n❌ ERRO CRÍTICO: ${error.message}`);
        writeLog(`\n=== ERRO CRÍTICO ===\n${error.message}\n${error.stack}\n==================\n`);
    }

    // Aguarda entrada do usuário para encerrar
    console.log("\n🔄 O programa continuará em execução para manter a sessão do WhatsApp ativa.");
    console.log("🛑 Para encerrar, pressione CTRL+C ou feche esta janela.");
    console.log("💡 Para enviar mais mensagens, edite os arquivos de configuração e reinicie o programa.");
    
    // Mantém o processo rodando
    setInterval(() => {}, 1000);
});

client.initialize();