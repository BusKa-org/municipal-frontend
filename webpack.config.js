const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const Dotenv = require('dotenv-webpack');

const mode = process.env.NODE_ENV || 'development';
const isProd = mode === 'production';

const transpileModules = [
  'react-native-vector-icons',
  'react-native-safe-area-context',
  'react-native-screens',
  '@react-navigation',
  'expo-font',
  '@expo-google-fonts',
].join('|');

module.exports = {
  entry: './index.web.tsx',
  mode,

  devServer: {
    static: {
      directory: path.join(__dirname, 'public'),
    },
    compress: true,
    port: 3000,
    hot: true,
    open: true,
    historyApiFallback: true, // Crucial for React Navigation

    // Proxy das chamadas de API para o backend. O browser fala sempre com a
    // mesma origem (localhost:3000), entao o CORS nao se aplica. Sem isso, a
    // API em producao rejeita o browser, ja que CORS_ORIGINS nao esta definido.
    // Apenas desenvolvimento: o app nativo chama a API direto.
    proxy: [
      {
        context: ['/v1'],
        target: process.env.API_PROXY_TARGET || 'http://buska.lsd.ufcg.edu.br:5000',
        changeOrigin: true,
      },
    ],
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    publicPath: '/',
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.(js|jsx|mjs|ts|tsx)$/,
        exclude: new RegExp(`node_modules\\/(?!(${transpileModules})\\/)`),
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      {
        test: /\.(ttf|otf|woff|woff2|eot)$/,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name][ext]',
        },
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]',
        },
      },
    ],
  },

  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      'react-native-vector-icons': 'react-native-vector-icons/dist',
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.tsx',
      '.ts',
      '.web.js',
      '.js',
      '.jsx',
      '.json',
      '.mjs',
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
      filename: 'index.html',
      title: 'BusKá - Transporte Escolar',
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(mode),
      __DEV__: JSON.stringify(!isProd),
    }),
    new Dotenv({
      path: './.env', // Garante que ele leia o arquivo da raiz
      safe: false,    // Define como true se quiser carregar um .env.example
      systemvars: true // Permite carregar variáveis do sistema também
    }),
  ],
};