# Use the official Node.js image as the base image
FROM node:16

# Create and change to the app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Copy the .env file into the container
COPY .env .env

# Expose the port that your app runs on
EXPOSE 8000

# Command to run the application
CMD ["npm", "start"]
