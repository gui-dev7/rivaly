/*
 * protocol-check.js — avisa quando a página foi aberta via file://.
 *
 * Script clássico (não é módulo) de propósito: sob file:// o navegador
 * recusa carregar ES Modules, então só um script comum consegue rodar para
 * explicar o que aconteceu. Antes isto vivia num <script> inline em cada
 * página; a Content-Security-Policy da V2 proíbe script inline, então o
 * aviso passou a ser um arquivo.
 */
(function () {
    if (window.location.protocol !== 'file:') return;

    function show() {
        var warning = document.getElementById('protocolWarning');
        if (warning) warning.hidden = false;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', show);
    } else {
        show();
    }
}());
