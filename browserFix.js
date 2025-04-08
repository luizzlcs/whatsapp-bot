const fs = require('fs');
const os = require('os');
const path = require('path');

module.exports = {
    getChromePath: () => {
        const platforms = {
            win32: [
                process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
                process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
                process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
            ],
            linux: [
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser'
            ],
            darwin: [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            ]
        };

        const paths = platforms[process.platform] || [];
        return paths.find(fs.existsSync);
    },

    ensureBrowserPermissions: () => {
        if (process.platform !== 'win32') {
            const chromePath = module.exports.getChromePath();
            if (chromePath) {
                try {
                    fs.chmodSync(chromePath, '755');
                } catch (e) {
                    console.warn('⚠️ Não foi possível ajustar permissões do Chrome:', e.message);
                }
            }
        }
    }
};