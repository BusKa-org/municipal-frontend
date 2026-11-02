# Projeto1 - React Native

Projeto React Native básico com uma tela Hello World.

## Pré-requisitos

- Node.js (>= 16)

## Instalação

1. Instale as dependências:
```bash
npm install
```

## Executando o projeto

### 🌐 **Web (Navegador) - RECOMENDADO** ⚡

A forma mais fácil de testar o app é no navegador do seu computador:

```bash
npm run web
```

Isso abrirá automaticamente o navegador em `http://localhost:3000` com o app renderizado dentro de um container que simula um celular vertical.

### Android (Emulador ou Dispositivo Físico)

**Pré-requisito:** Configure o Android SDK (veja SETUP.md)

1. Inicie o Metro Bundler:
```bash
npm start
```

2. Em outro terminal, execute:
```bash
npm run android
```

### iOS (Simulador - apenas macOS)

**Pré-requisito:** Instale o Xcode completo da App Store

1. Instale os CocoaPods:
```bash
cd ios
pod install
cd ..
```

2. Execute:
```bash
npm run ios
```

## Visualizando no Navegador

O app será renderizado dentro de um container que simula um celular iPhone (375x812px) em modo vertical. O layout é responsivo e se adapta a telas menores.

## Estrutura do Projeto

```
projeto1/
├── App.js              # Componente principal com a tela Hello World
├── index.js            # Ponto de entrada para React Native (mobile)
├── index.web.js        # Ponto de entrada para Web
├── webpack.config.js   # Configuração do Webpack para web
├── public/
│   └── index.html      # HTML template para web
├── app.json            # Configuração do app
├── package.json        # Dependências do projeto
└── README.md           # Este arquivo
```

## Scripts Disponíveis

- `npm run web` - Executa o app no navegador (porta 3000)
- `npm run build:web` - Gera build de produção para web (em `dist/`)
- `npm start` - Inicia o Metro Bundler (para mobile)
- `npm run android` - Executa no Android
- `npm run ios` - Executa no iOS

> **Hospedagem web:** o servidor que servir o `dist/` precisa devolver o `index.html` para qualquer caminho que não seja um arquivo (fallback de SPA). Sem isso, o link do e-mail de redefinição de senha (`/redefinir-senha?token=...`) dá 404. No nginx: `try_files $uri /index.html;`. Em dev o `historyApiFallback` do webpack já faz isso.
