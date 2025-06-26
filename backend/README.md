# Backend - Node.js + Express

The backend application built with Node.js and Express, providing a RESTful API for the frontend application. It includes middleware support, environment configuration, and essential development tools.

## Features

- **Fast & Lightweight**: Built with Express for efficient request handling.
- **CORS Support**: Uses CORS middleware to enable cross-origin requests.
- **Environment Variables**: Managed via dotenv for configuration.
- **Hot Reloading**: Uses Nodemon for automatic server restarts during development.

## Installation

Clone the repository and install dependencies:

```sh
npm install
```

## Available Scripts

### Start Server

```sh
npm start
```

Runs the server using Node.js.

### Development Mode

```sh
npm run dev
```

Starts the server with Nodemon for live reloading.

## Project Structure

```
backend/
│── index.js           # Entry point of the application
│── .env               # Environment variables (ignored in Git)
│── package.json       # Project dependencies and scripts
│── node_modules/      # Installed dependencies
```

## Dependencies

- **Express** - Web framework for Node.js
- **CORS** - Middleware for handling cross-origin requests
- **Dotenv** - Loads environment variables from a `.env` file
- **Nodemon** - Development tool for auto-restarting the server

## Environment Variables

Create a `.env` file in the root directory and define necessary variables:

```
PORT=5000
```

## License



