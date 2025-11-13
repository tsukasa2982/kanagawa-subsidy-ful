# Dockerfile

# 公式のNode.js 18イメージを使用
FROM node:18-alpine

# アプリケーションディレクトリを作成し、移動
WORKDIR /app

# 依存関係を先にインストール
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# プロジェクトの全ファイルをコピー
COPY . .

# Next.jsアプリをビルド
RUN npm run build

# package.jsonの "start" スクリプトを実行してアプリを起動
# App Hostingが自動的にPORT環境変数を設定してくれます
CMD ["npm", "run", "start"]