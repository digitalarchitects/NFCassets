FROM node:22-slim

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy app source
COPY app.js ./
COPY db/ ./db/
COPY middleware/ ./middleware/
COPY routes/ ./routes/
COPY lib/ ./lib/
COPY public/ ./public/
COPY .env.example ./

RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "app.js"]
