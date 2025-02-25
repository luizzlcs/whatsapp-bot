import path from 'path';  // Módulo nativo do Node.js
import whatsapp from 'whatsapp-web.js';  // Importando o pacote inteiro como default
import qrcode from 'qrcode';  // Módulo externo
import fs from 'fs';  // Módulo nativo do Node.js
import open from 'open';  // Módulo externo
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Obtendo __dirname em módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Caminhos absolutos para os arquivos
const numerosPath = path.join(__dirname, 'numeros.txt');
const mensagemPath = path.join(__dirname, 'mensagem.txt');
const logPath = path.join(__dirname, 'log.txt');

const { Client, LocalAuth } = whatsapp;  // Desestruturando para pegar Client e LocalAuth

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log("Escaneie o QR Code abaixo para conectar:");

    qrcode.toFile('qrcode.png', qr, {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.92
    }, (err) => {
        if (err) {
            console.error('Erro ao gerar o QR Code:', err);
        } else {
            console.log('QR Code gerado como "qrcode.png". Abrindo a imagem para escanear...');
            open('qrcode.png');
        }
    });
});

client.on('ready', async () => {
    console.log("✅ Bot do WhatsApp está pronto para enviar mensagens!");

    // Lê os números de telefone e a mensagem a partir dos arquivos
    const numeros = fs.readFileSync(numerosPath, 'utf8').split('\n').map(n => n.trim());
    const mensagem = fs.readFileSync(mensagemPath, 'utf8');

    let mensagensEnviadas = 0;
    let mensagensNaoEnviadas = 0;

    for (let numero of numeros) {
        if (numero) {
            try {
                const contato = await client.getNumberId(numero);
                if (contato) {
                    await client.sendMessage(contato._serialized, mensagem);
                    console.log(`✅ Mensagem enviada para ${numero}`);

                    const dataHora = new Date();
                    const logData = `
Date: ${dataHora.toLocaleDateString('pt-BR')}
Time: ${dataHora.toLocaleTimeString('pt-BR')}
Phone Number: ${numero}
Message: ${mensagem}

                    `;
                    fs.appendFileSync(logPath, logData);
                    mensagensEnviadas++;
                } else {
                    console.log(`❌ O número ${numero} NÃO possui WhatsApp.`);
                    mensagensNaoEnviadas++;
                }
            } catch (erro) {
                console.log(`❌ Erro ao enviar para ${numero}: ${erro.message}`);
                mensagensNaoEnviadas++;
            }
        }
    }
 
    const resumoLog = `
✅ Total de mensagens enviadas: ${mensagensEnviadas}
❌ Total de mensagens não enviadas: ${mensagensNaoEnviadas}

    `;
    fs.appendFileSync(logPath, resumoLog);
 
    console.log("✅ Todas as mensagens foram processadas!");
});

client.initialize();
