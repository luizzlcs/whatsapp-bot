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

    const numeros = fs.readFileSync('numeros.txt', 'utf8').split('\n').map(n => n.trim());
    const mensagem = `
    E aí, tudo bem? Esperamos que sim! 😊
    
    Se você está recebendo esta mensagem, é porque já garantiu sua inscrição para o Retiro Espiritual 2025! 🎉🙏
    
    Agora, se ainda não entrou no nosso grupo de informações, não perde tempo! Clica no link abaixo e já chega junto! Em breve, vamos compartilhar todas as novidades e detalhes sobre o retiro.
    
    Vai ser incrível e queremos você por dentro de tudo! ✨🔥
    
    Nos vemos em breve!
    
    🔥 | https://chat.whatsapp.com/EaCPZJsLM3ADm7uby2deL2
    `;

    for (let numero of numeros) {
        if (numero) {
            try {
                // Verifica se o número existe no WhatsApp
                const contato = await client.getNumberId(numero);
                
                if (contato) {
                    await client.sendMessage(contato._serialized, mensagem);
                    console.log(`✅ Mensagem enviada para ${numero}`);
                } else {
                    console.log(`❌ O número ${numero} NÃO possui WhatsApp.`);
                }
            } catch (erro) {
                console.log(`❌ Erro ao enviar para ${numero}: ${erro.message}`);
            }
        }
    }

    console.log("✅ Todas as mensagens foram processadas!");
});

client.initialize();
