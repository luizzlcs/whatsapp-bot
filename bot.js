const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log("Escaneie o QR Code abaixo para conectar:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    console.log("✅ Bot do WhatsApp está pronto para enviar mensagens!");

    // Lê os números de telefone do arquivo 'numeros.txt'
    const numeros = fs.readFileSync('numeros.txt', 'utf8').split('\n').map(n => n.trim());

    // Lê o conteúdo da mensagem do arquivo 'mensagem.txt'
    const mensagem = fs.readFileSync('mensagem.txt', 'utf8');

    let mensagensEnviadas = 0;
    let mensagensNaoEnviadas = 0;

    for (let numero of numeros) {
        if (numero) {
            try {
                // Verifica se o número existe no WhatsApp
                const contato = await client.getNumberId(numero);
                
                if (contato) {
                    // Envia a mensagem
                    await client.sendMessage(contato._serialized, mensagem);
                    console.log(`✅ Mensagem enviada para ${numero}`);

                    // Prepara o log
                    const dataHora = new Date();
                    const logData = `
Date: ${dataHora.toLocaleDateString('pt-BR')}
Time: ${dataHora.toLocaleTimeString('pt-BR')}
Phone Number: ${numero}
Message: ${mensagem}

                    `;

                    // Cria ou adiciona ao arquivo log.txt
                    fs.appendFileSync('log.txt', logData);

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

    // Adiciona as contagens no final do log
    const resumoLog = `
✅ Total de mensagens enviadas: ${mensagensEnviadas}
❌ Total de mensagens não enviadas: ${mensagensNaoEnviadas}

    `;

    fs.appendFileSync('log.txt', resumoLog);

    console.log("✅ Todas as mensagens foram processadas!");
});

client.initialize();
