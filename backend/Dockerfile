FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY uploads ./uploads
EXPOSE 5000
CMD ["npm", "start"]
