function formatarDataHora(date) {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const segundos = String(date.getSeconds()).padStart(2, '0');

    return `${dia}/${mes}/${ano} ${horas}:${minutos}:${segundos}`;
}

function formatarNomeArquivoData(date) {
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    const horas = String(date.getHours()).padStart(2, '0');
    const minutos = String(date.getMinutes()).padStart(2, '0');
    const segundos = String(date.getSeconds()).padStart(2, '0');

    return `${dia}-${mes}-${ano}_${horas}-${minutos}-${segundos}`;
}

function mostrarLoading() {
    const frames = ['[▰▱▱▱▱▱▱]', '[▰▰▱▱▱▱▱]', '[▰▰▰▱▱▱▱]', '[▰▰▰▰▱▱▱]', 
                   '[▰▰▰▰▰▱▱]', '[▰▰▰▰▰▰▱]', '[▰▰▰▰▰▰▰]', '[▰▰▰▰▰▰▱]',
                   '[▰▰▰▰▰▱▱]', '[▰▰▰▰▱▱▱]', '[▰▰▰▱▱▱▱]', '[▰▰▱▱▱▱▱]'];
    let i = 0;
    
    const interval = setInterval(() => {
        process.stdout.write(`\r🔍 Verificando licença ${frames[i = (i + 1) % frames.length]}`);
    }, 120);

    return {
        stop: () => {
            clearInterval(interval);
            process.stdout.write('\r✔ Verificação concluída!' + ' '.repeat(30) + '\n');
        }
    };
}

module.exports = {
    formatarDataHora,
    formatarNomeArquivoData,
    mostrarLoading
};