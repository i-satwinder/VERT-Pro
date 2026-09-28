## Getting Started

This file covers how to get started with VERT.

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment variables](#environment-variables)
- [Running Locally](#running-locally)
- [PDF Tools](#pdf-tools)
- [Building for Production](#building-for-production)
- [Using Docker](#using-docker)

### Prerequisites

Make sure you have the following installed:
- [Bun](https://bun.sh/)

### Installation

First, clone the repository:
```sh
git clone https://github.com/VERT-sh/VERT
cd VERT/
```

Install dependencies:
```sh
bun i
```

And finally, make sure you create a `.env` file in the root of the project. We've included a [`.env.example`](../.env.example) file which you can use to get started:
```sh
cp .env.example .env
```

### Environment variables

VERT uses the following environment variables (all prefixed with `PUB_`). Set them in your `.env` file during development, or pass them as Docker build args for production.

| Variable | Description | Default |
|---|---|---|
| `PUB_ENV` | Application environment: `production`, `development`, or `nightly` | `development` |
| `PUB_HOSTNAME` | Hostname used for analytics tracking | `localhost:5173` |
| `PUB_PLAUSIBLE_URL` | URL for your Plausible Analytics instance (leave empty to disable) | *(empty)* |
| `PUB_VERTD_URL` | URL of the vertd daemon for video conversion | `https://vertd.vert.sh` |
| `PUB_DISABLE_ALL_EXTERNAL_REQUESTS` | Disable all external requests (vertd, Stripe, Plausible, etc.) | `false` |
| `PUB_DONATION_URL` | URL for the donation page | `https://donations.vert.sh` |
| `PUB_STRIPE_KEY` | Stripe publishable key for donations | *(upstream default)* |
| `PUB_DISABLE_FAILURE_BLOCKS` | Disable blocking repeated failed video conversions within an hour | `false` |

### Running Locally

To run the project locally, run `bun dev`.

This will start a development server. Open your browser and navigate to `http://localhost:5173` to see the application.

### PDF Tools

VERT includes built-in PDF utilities accessible at `/tools` (`http://localhost:5173/tools` during development). These tools run entirely on-device — no files are uploaded to any server.

Available tools:

- **Merge** — Combine two or more PDF files into one. Reorder files before merging.
- **Split** — Extract page ranges from a PDF. Specify ranges with semicolons (e.g. `1-3;4-6;7-12`). Each range becomes a separate file; multiple parts are downloaded as a zip.
- **Compress** — Reduce PDF file size by re-saving with object streams. Optionally strip metadata (title, author, etc.) for additional space savings.

### Building for Production

To build the project for production, run `bun run build`.

This will build the site to the `build` folder. You should then use a web server like [nginx](https://nginx.org) to serve the files inside that folder.

### Using Docker

Check the dedicated [Docker](./DOCKER.md) page.
