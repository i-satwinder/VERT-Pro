## Using Docker

This file covers how to run VERT under a Docker container.

- [Manually building the image](#manually-building-the-image)
- [Using an image from the GitHub Container Registry](#using-an-image-from-the-github-container-registry)
- [Environment variables reference](#environment-variables-reference)

### Manually building the image

First, clone the repository:

```shell
git clone https://github.com/VERT-sh/VERT
cd VERT/
```

Then build a Docker image with:

```shell
docker build -t vert-sh/vert \
    --build-arg PUB_ENV=production \
    --build-arg PUB_HOSTNAME=vert.sh \
    --build-arg PUB_PLAUSIBLE_URL=https://plausible.example.com \
    --build-arg PUB_VERTD_URL=https://vertd.vert.sh \
    --build-arg PUB_DISABLE_ALL_EXTERNAL_REQUESTS=false \
    --build-arg PUB_DONATION_URL=https://donations.vert.sh \
    --build-arg PUB_STRIPE_KEY="" \
    --build-arg PUB_DISABLE_FAILURE_BLOCKS=false .
```

You can then run it by using:

```shell
docker run -d \
    --restart unless-stopped \
    -p 3030:80 \
    --name "vert" \
    vert-sh/vert
```

This will do the following:

- Use the previously built image as the container `vert`, in detached mode
- Continuously restart the container until manually stopped
- Map `3030/tcp` (host) to `80/tcp` (container)

We also have a [`docker-compose.yml`](/docker-compose.yml) file available. Use `docker compose up` if you want to start the stack, or `docker compose down` to bring it down. You can pass `--build` to `docker compose up` to rebuild the Docker image (useful if you've changed any of the environment variables) as well as `-d` to start it in detached mode. You can read more about Docker Compose in general [here](https://docs.docker.com/compose/intro/compose-application-model/).

To customise the host port, set the `PORT` environment variable before running:

```shell
PORT=8080 docker compose up -d
```

### Using an image from the GitHub Container Registry

A pre-built image is published to `ghcr.io/i-satwinder/vert-pro` on every push to `master`. It supports both `linux/amd64` and `linux/arm64`. You can pull and run it directly without cloning the repo:

> **Note:** Environment variables (e.g. `PUB_PLAUSIBLE_URL`) are baked into the image at build time and cannot be changed at runtime. If you need custom values, [build the image manually](#manually-building-the-image).

```shell
docker run -d \
    --restart unless-stopped \
    -p 3030:80 \
    --name "vert-pro" \
    ghcr.io/i-satwinder/vert-pro:latest
```

### Environment variables reference

All environment variables accepted by the Dockerfile. When using `docker compose`, these can be set in a `.env` file in the repository root.

| Variable | Description | Default |
|---|---|---|
| `PUB_ENV` | Application environment: `production`, `development`, or `nightly` | `production` |
| `PUB_HOSTNAME` | Hostname used for analytics tracking | `localhost:5173` |
| `PUB_PLAUSIBLE_URL` | URL for your Plausible Analytics instance (leave empty to disable) | *(empty)* |
| `PUB_VERTD_URL` | URL of the vertd daemon for video conversion | `https://vertd.vert.sh` |
| `PUB_DISABLE_ALL_EXTERNAL_REQUESTS` | Disable all external requests (vertd, Stripe, Plausible, etc.) | `false` |
| `PUB_DONATION_URL` | URL for the donation page | `https://donations.vert.sh` |
| `PUB_STRIPE_KEY` | Stripe publishable key for donations | *(upstream default)* |
| `PUB_DISABLE_FAILURE_BLOCKS` | Disable blocking repeated failed video conversions within an hour | `false` |
| `PORT` | Host port when using docker compose | `3030` |
