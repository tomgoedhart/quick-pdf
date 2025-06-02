# Quick Graveer PDF API

This project provides an API endpoint that generates PDF's.
It also provides an endpoint to change folders on Synology or S3.
Generated mostly by AI

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

## Server

Deployed on local server at Quick.
Using Gunicorn to expose on network
Using Ngrok to expose on internet (using Kees's free account)

So:

- The call is being made to vercel (eg https://quickgraveer-pdf-api.vercel.app/quote)
- Script on Vercel generates the PDF and uploads it to S3
- Script on Vercel calls the printer API on: https://cb1d-84-246-3-220.ngrok-free.app/print
- Ngrok puts call through to service on local server at Quick (eg http://0.0.0.0:6789/print)
- Local service prints PDF to printer

See printer list at https:/clam-guiding-gelding.ngrok-free.app/printers

# Ngrok

ngrok http --url=clam-guiding-gelding.ngrok-free.app 6789

# To get the print service running on the server at Quick

source venv/bin/activate  
gunicorn --bind 0.0.0.0:6789 app:app &  
ngrok http --url=clam-guiding-gelding.ngrok-free.app http://0.0.0.0:6789 &
