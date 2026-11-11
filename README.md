# MangaShelf

Biblioteca pessoal para organizar mangás, acompanhar capítulos e manter backups locais.

## Executar no desktop durante o desenvolvimento

```sh
npm install
npm run desktop:dev
```

## Gerar o instalador Windows

```sh
npm run desktop:build
```

O instalador aparece em `release/builds/`.

## Publicar uma versão com atualização automática

O app consulta releases públicos em `Claudio0666/Manga`. O workflow `.github/workflows/desktop-release.yml` compila o instalador e publica os arquivos de atualização quando uma tag `v*` é enviada.

1. Atualize a versão em `package.json` e `package-lock.json`.
2. Envie as alterações para o GitHub.
3. Crie e envie uma tag correspondente à versão, por exemplo `v1.4.0`.

```sh
git tag v1.4.0
git push origin v1.4.0
```

O GitHub Actions cria o release e publica o instalador e o manifesto que o app usa para atualizar. A primeira release precisa ser publicada antes de uma instalação existente conseguir encontrar atualizações.
