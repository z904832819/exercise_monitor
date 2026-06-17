FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    ADMIN_BOOTSTRAP_USERS_B64=W3sidXNlcm5hbWUiOiJxaWFuY2hhbmciLCJkaXNwbGF5TmFtZSI6Iua1heWUsSIsInBhc3N3b3JkSGFzaCI6IjI2YmE2YzQwYTE3NDIyYzQzMTgyMmQ0Yjc0ZDI0NDIzODMzNjE4NTcwY2VkZWJlYjE4ZjJlZWI1NzlhOWYzNDg3ZjcyOWQzNmYxZmZkZTFjNjg1OGZhZGNlZTQxOGIzMzdiZTJhYWQ5MzFjZTExMDFlZDJiMWNhMzdlOGQwNTFmIiwic2FsdCI6ImVkZGZjYWU0N2RkYzM1N2M1ZjQ2NjBhMzM0YTM2MDcwIiwicGFnZVBlcm1pc3Npb25zIjp7ImNoYXQiOnRydWUsImhlYWx0aCI6dHJ1ZSwibW90aW9uIjp0cnVlLCJwcm9maWxlIjp0cnVlLCJvdmVydmlldyI6dHJ1ZSwibnV0cml0aW9uIjp0cnVlfX1d

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/dist ./dist
COPY --from=build /app/rag ./rag

RUN mkdir -p /app/tmp/uploads/avatars && chown -R node:node /app

USER node

EXPOSE 8787

CMD ["npm", "run", "start:docker"]
