# Instalação do Google Tag Manager — docs.appsbox.com.br

Container ID: **GTM-NNMWVGR8**

## O que já está configurado no GTM (não precisa fazer nada aqui)

- **AdSense - Auto Ads**: script do AdSense (`ca-pub-2534156065637168`), dispara na inicialização.
- **Banner de Consentimento (Cookies)**: banner LGPD com aceitar/rejeitar, dispara quando o DOM está pronto.
- **Consentimento - Estado Padrão**: define o estado padrão de consentimento (`ad_storage`, `analytics_storage` etc. como `denied` até o usuário decidir), dispara na inicialização do consentimento.
- **Tag do Google - Analytics**: GA4 (`G-H7VV5TK9M7`), dispara na inicialização.

Tudo isso já está **publicado** (versão ativa) no container. O único passo que falta é instalar o snippet do GTM no código do site — é isso que este documento explica.

## Passo 1 — Cole no `<head>`, o mais alto possível

```html
<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NNMWVGR8');</script>
<!-- End Google Tag Manager -->
```

## Passo 2 — Cole logo após a abertura da tag `<body>`

```html
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NNMWVGR8"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
```

Ambos os blocos precisam estar em **todas as páginas** do site (normalmente isso já é resolvido se você tem um template/layout único — cole nele).

## Passo 3 — Verificar se funcionou

1. Abra `https://docs.appsbox.com.br` no navegador.
2. Abra o DevTools (F12) → aba **Network** → filtre por `gtm.js`. Deve aparecer uma requisição para `googletagmanager.com/gtm.js?id=GTM-NNMWVGR8` com status 200.
3. Alternativa mais simples: instale a extensão **Tag Assistant Legacy** ou use o [Tag Assistant](https://tagassistant.google.com/) do Google, aponte para a URL do site e confirme que o container `GTM-NNMWVGR8` aparece como "Found" e as tags disparam.
4. Confira visualmente se o banner de cookies LGPD aparece na primeira visita (em aba anônima, para simular um usuário novo).

## Observação sobre o AdSense

Como o domínio raiz `appsbox.com.br` já está aprovado no AdSense, o subdomínio `docs.appsbox.com.br` é coberto automaticamente — não é necessário cadastrá-lo separadamente no AdSense. Mas o Google ainda pode restringir anúncios especificamente nesse subdomínio se o conteúdo violar as políticas, então vale acompanhar o painel do AdSense nos primeiros dias após a instalação.
