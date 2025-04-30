# 📱 WhatsApp Send Message - Manual Completo

<div id="indice"></div>

## 📜 Índice Lógico

1. [🌟 Introdução](#introducao)
2. [🚀 Primeiros Passos](#primeiros-passos)
   - [1. Executando o Send Message](#executando-sendmessage)
3. [🔐 Validação da Licença](#validacao-licenca)
4. [📱 Conexão com WhatsApp](#conexao-whatsapp)
5. [✉️ Envio de Mensagens](#envio-mensagens)
6. [📂 Estrutura de Pastas](#estrutura-pastas)
7. [⚙️ Personalização](#personalizacao)
   - [Arquivo de Contatos](#arquivo-numeros)
   - [Arquivo de Mensagem](#arquivo-mensagem)
8. [⚠️ Boas Práticas](#boas-praticas)
9. [❓ Suporte](#suporte)

---

<div id="introducao"></div>

## 🌟 Introdução

### 🤖 O Que é o WhatsApp Send Message?

Um sistema inteligente que permite:

- ✅ Enviar **mensagens padronizadas** para múltiplos contatos
- ⏱ Economizar **até 95% do tempo** comparado ao envio manual
- 📊 Gerar **relatórios completos** de entregas e falhas

### 📦 O Que Você Recebeu?

- SendMessage.exe
- Salve o aplicativo em uma pasta de fácil acesso (ex.: `SendMessage`).

### 🔍 Pré-requisitos

- Computador com **Windows 10/11**
- Navegador **Google Chrome** instalado
- Conta no **WhatsApp Business** ou regular
- Licença ativa (fornecida por email)

---

<div id="primeiros-passos"></div>

## 🚀 Primeiros Passos

### 1. Executando o Send Message

1. Dê **duplo clique** no arquivo `SendMessage.exe`
2. Aguarde a janela do Prompt de Comando abrir  
   _Exemplo de tela inicial:_
   ```plaintext
   🕒 30/04/2025 12:50:19 | Iniciando verificação
   ✔ Verificação concluída!
   📧 Digite o email cadastrado na sua licença:
   ```

---

## 🔐 Validação da Licença

O sistema solicitará:

```plaintext
📧 Digite o email cadastrado na sua licença:
```

- Informe seu e-mail (ex.: exemplo-email@gmail.com)
- Pressione **ENTER**

✅ O que acontece?

- Verifica sua licença e exibe os detalhes:

```plaintext
✅ Licença válida! Detalhes:
👤 Nome: Seu Nome
📧 Email: seunome@empresa.com
📅 Expiração: 31/12/2025
💻 Dispositivos: 1/3 ativos
```

- **"Dispositivos ativos"** mostra quantas máquinas podem usar o Send Message simultaneamente (ex.: 1/3 = já está em 1 dispositivo e pode usar em mais 2).

---

<div id="conexao-whatsapp"></div>

## 📱 Conexão com WhatsApp

### Passo a Passo:

1. O Chrome abrirá automaticamente no WhatsApp Web
   - ❌ **Não scanear o QRCode nesta página!**
2. No Prompt de Comando observe a mensagem:
   ```plaintext
   🔎 QR Code recebido - Escaneie para autenticar
   📷 QR Code salvo em: E:\SendMessage\temp\qrcode.png
   ```
   - Uma imagem do QRCode será aberta no visualizador de imagem padrão do Windows. Escaneie este QRCode pelo seu WhatsApp móvel (Menu > Dispositivos conectados > Conectar dispositivo).

 <div id="envio-mensagens"></div>

## ✉️ Envio de Mensagens  
O Send Message começará automaticamente:
### Fluxo Automático:  
1. O Send Message lê os contatos em `config/numeros.txt`  
2. Envia a mensagem de `config/mensagem.txt`  
3. Exibe progresso em tempo real:  
   ```plaintext
   📤 Iniciando envio para X números...
   🔄 Progresso: [██████████░░░░░░] 60%  ✅ 12 enviadas | ❌ 3 falhas
   ```

#### 📊 Relatório Final

```plaintext
========================
   📋 RESUMO DO ENVIO:
========================
📤 Total: 12 contatos
✅ Sucessos: 10 (83%)
❌ Falhas: 2 (17%)
⏱ Duração: 1min 23s
========================
```

---

<div id="estrutura-pastas"></div>

## 📂 Estrutura de Pastas

```bash
SendMessage/
├── .wwebjs_auth/    # Dados de sessão (não mexa)
├── .wwebjs_cache    # Cache da Sessão WhatsApp (não mexa)
├── config/
│   ├── numeros.txt  # Lista de contatos
│   └── mensagem.txt # Texto da mensagem
├── logs/            # Histórico de envios
└── temp/            # QRCode temporário
```

---

<div id="personalizacao"></div>

## ⚙️ Personalização

### 📋 Arquivo numeros.txt

- Adicione um número por linha, no formato:
- Formato correto:
  ```plaintext
  5511912345678
  5516998765432
  ```
- Caracteres como `( ), -, /, ~, @, !,` são ignorados.
- (55)11-99999-9999@abc → O Send Message lerá apenas 5511999999999.

### ✍️ Arquivo mensagem.txt

- Edite com sua mensagem personalizada (suporta emojis, links e quebras de linha):
- Exemplo profissional:

  ```text
  Olá [NOME], tudo bem?

  Esta é uma mensagem automática enviada pelo Send Message.
  📅 Data: 30/04/2025
  ✨ Atenciosamente,
  Equipe Pedro Barusco
  ```

  🔄 **Próximos Envios**

  - Após a primeira autenticação, o Send Message não pedirá QRCode novamente (sessão fica salva).

  - Sempre atualize os arquivos numeros.txt e mensagem.txt antes de executar.

---

<div id="boas-praticas"></div>

## ⚠️ Boas Práticas

1. Limpe a lista de contatos após o envio para evitar disparos acidentais.
2. Verifique os logs em logs/ se houver falhas.
3. Sempre teste com 2-3 números conhecidos
4. Mantenha a licença válida (renove antes do vencimento).
5. Limpe o arquivo `numeros.txt` após cada envio
6. Evite mensagens muito longas (>500 caracteres)
7. Nunca exceda 50-100 mensagens/hora (o WhatsApp pode flagar como SPAM).
8. Se precisar enviar para +200 contatos, divida em lotes (ex.: 50 por hora).
9. Mensagem Não Invasiva, Inclua opt-out no rodapé:
   **Se não deseja receber mensagens, responda "SAIR"**.
10. Horário Comercial: Envie apenas entre 9h-18h (evite fins de semana).
11. Identificação Clara, Sempre assine com: `Atenciosamente,  
[Sua Empresa]  
CNPJ: XX.XXX.XXX/0001-XX  `.
12. Taxa de Resposta, se +30% dos contatos não responderem em 24h, revise o conteúdo (pode estar sendo marcado como SPAM).

---

<div id="suporte"></div>

## ❓ Suporte

Para problemas técnicos:

📧 Email: luizzlcs@gmail.com  
💬 Telegram: t.me/luizzlcs

_Documentação atualizada em 30/04/2025_
