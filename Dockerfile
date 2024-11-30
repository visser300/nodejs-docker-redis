FROM node:lts-alpine

WORKDIR /app

RUN npm install -g ts-node typescript

COPY package*.json tsconfig.json ./

RUN npm install --production=false

# Copy source files
COPY . .

CMD ["npm", "run", "start"]