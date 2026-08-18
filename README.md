# AppsBox Conversor de Documentos

PWA de conversão local de TXT, Markdown e HTML para HTML, TXT ou Markdown.
Os documentos nunca são enviados ao backend; o único serviço é o contador
global agregado. O produto é publicado em <https://docs.appsbox.com.br>.

## Desenvolvimento

```bash
npm ci
npm run check
npm run build
```

O frontend é HTML, CSS e TypeScript estrito, compilado para `dist/`. A
conversão ocorre no navegador com `File.text()` e `DOMParser`; não há engine
remota nem upload. O backend opcional local roda em `127.0.0.1:9700`.

## Operação

- frontend: `/var/www/appsbox-conv-documentos/current`;
- releases: `/var/www/appsbox-conv-documentos/releases/`;
- contador: `appsbox-conv-documentos.service`;
- banco: `/mnt/dados/appsbox-conv-documentos/contador.sqlite`;
- health check: `curl http://127.0.0.1:9700/health`.

O modelo de serviço e VirtualHost está em `deploy/`. O deploy compila, publica
uma release imutável, alterna `current` atomicamente e valida a URL pública.
Consulte o [PRD](PRD_AppsBox_Conversor_de_Documentos.md) para gates de novas
engines e formatos; não anuncie formatos adicionais sem atualizar a matriz e
os testes de compatibilidade.
