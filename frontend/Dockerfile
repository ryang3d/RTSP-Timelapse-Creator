FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Accept build arguments for React environment variables
ARG REACT_APP_API_URL=http://localhost:3001
ARG REACT_APP_WS_URL=ws://localhost:3002

# Make them available to the build process
ENV REACT_APP_API_URL=${REACT_APP_API_URL}
ENV REACT_APP_WS_URL=${REACT_APP_WS_URL}

RUN npm run build

FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
