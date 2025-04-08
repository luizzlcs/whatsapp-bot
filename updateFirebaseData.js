const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

// Configuração do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyD4G8p3H6J5Z7X9Y8W2Q1R3T4U5I6O7P8",
  authDomain: "seven-manager-cffc7.firebaseapp.com",
  projectId: "seven-manager-cffc7",
  storageBucket: "seven-manager-cffc7.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Dados que serão atualizados
const userData = {
  active: true,
  allowedFeatures: ["envio_mensagens", "leitura_contatos"],
  blocked: false,
  devices: ["5b96ffc78c02710aa600812e7797228c"],
  email: "thiago.developed@gmail.com",
  expirationDate: "2026-08-04",
  lastAccess: "",
  maxDevices: 1,
  name: "Thiago Pereira"
};

async function updateFirebaseData() {
  try {
    // Referência ao documento (usando o email como ID)
    const userDocRef = doc(db, "botWhatsApp", userData.email);
    
    // Atualiza ou cria o documento
    await setDoc(userDocRef, userData, { merge: true });
    
    console.log('✅ Dados atualizados com sucesso!');
    console.log('Documento ID:', userData.email);
    console.log('Dados atualizados:', userData);
  } catch (error) {
    console.error('❌ Erro ao atualizar dados:');
    console.error(error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

updateFirebaseData();