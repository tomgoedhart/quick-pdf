# Quick Graveer PDF API

This project provides an API endpoint that generates PDF's.
It also provides an endpoint to change folders on S3.

## Features

Generates PDF's for the following types:
- order (pakbon)
- invoice (Factuur)
- quote (Offerte)
- address sticker
- post sticker

## Endpoints

The following endpoints are available:

- `/api/invoice`
- `/api/order`
- `/api/quote`
- `/api/sticker`
- `/api/move-folder`

## Installation

To get started with this project, clone the repository and install the dependencies:

```bash
yarn install
```

## Usage

To run the application, use the following command:

```bash
yarn start
```

## Deployment

To deploy the application to a production environment, follow these steps:

1. Commit your changes to the repository.
2. Push the changes to the remote repository.
3. That's it.

## Vercel

This project is deployed on Vercel.
https://vercel.com/qgraveers-projects/quickgraveer-pdf-api
