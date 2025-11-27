FROM node:20-slim

# Set work directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy the rest of the backend code
COPY . .

# Create necessary directories
RUN mkdir -p logs

# Expose Express port
EXPOSE 8000

# Set environment variables
ENV NODE_ENV=production

# Start Express server
CMD ["node", "src/index.js"]