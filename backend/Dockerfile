FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# Install all dependencies (including devDependencies for tsx)
RUN npm install

COPY . .

EXPOSE 4000

# Use tsx to run the application directly
CMD ["npx", "tsx", "src/index.ts"]
