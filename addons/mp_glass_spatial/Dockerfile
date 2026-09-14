FROM python:3.12.12-slim-bookworm
ARG BUILD_VERSION=0.3.1
ARG BUILD_ARCH
LABEL io.hass.version="${BUILD_VERSION}" io.hass.type="addon" io.hass.arch="${BUILD_ARCH}"
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY server.py raster.py spatial_contract.py spatial_gemini.py spatial.schema.json ./
ENV PYTHONUNBUFFERED=1
EXPOSE 8099
CMD ["python", "server.py"]
