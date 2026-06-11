# Деплой на Railway с GitHub

## 1. Качи кода в GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/ТВОЕТО_ИМЕ/error-tracking.git
git push -u origin main
```

## 2. Създай проект в Railway

1. Отиди на [railway.app](https://railway.app) и влез с GitHub акаунта си
2. Натисни **New Project** → **Deploy from GitHub repo**
3. Избери твоето хранилище

## 3. Добави PostgreSQL база данни

1. В Railway проекта натисни **+ New** → **Database** → **Add PostgreSQL**
2. Railway автоматично добавя `DATABASE_URL` като environment variable

## 4. Настрой environment variables

В Railway → твоят сервис → **Variables** добави:
```
NODE_ENV=production
```
(`DATABASE_URL` се добавя автоматично от PostgreSQL плъгина)

## 5. Готово!

Railway автоматично:
- Деплойва при всеки `git push` към `main`
- Запазва базата данни между деплойванията
- Дава ти публичен URL (напр. `https://error-tracking-production.up.railway.app`)

## Локално тестване

```bash
npm install
# Копирай .env.example → .env и попълни DATABASE_URL
cp .env.example .env
npm start
```
Отвори http://localhost:3000
