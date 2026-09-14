"""Decode untrusted files in a short-lived, resource-limited process."""
from io import BytesIO
import sys
import warnings

from PIL import Image, ImageOps

MAX_FILE = 8 * 1024 * 1024
MAX_PIXELS = 24_000_000
Image.MAX_IMAGE_PIXELS = MAX_PIXELS
warnings.simplefilter("error", Image.DecompressionBombWarning)


def rasterize(data, mime, page=1):
    if not data or len(data) > MAX_FILE:
        raise ValueError("invalid_file")
    if mime == "application/pdf":
        if not data.startswith(b"%PDF-"):
            raise ValueError("invalid_file")
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(data) as pdf:
            if len(pdf) > 100 or not 1 <= page <= len(pdf):
                raise ValueError("invalid_file")
            pdf_page = pdf[page-1]
            try:
                width, height = pdf_page.get_size()
                if min(width, height) <= 0 or max(width, height) > 20000:
                    raise ValueError("invalid_file")
                bitmap = pdf_page.render(scale=min(2, 2048/max(width, height)))
                try:
                    image = bitmap.to_pil().convert("RGB")
                finally:
                    bitmap.close()
            finally:
                pdf_page.close()
    else:
        with Image.open(BytesIO(data)) as source:
            if source.format not in {"PNG", "JPEG", "WEBP"} or Image.MIME.get(source.format) != mime:
                raise ValueError("invalid_file")
            if source.width*source.height > MAX_PIXELS or getattr(source, "n_frames", 1) != 1:
                raise ValueError("invalid_file")
            source.load()
            image = ImageOps.exif_transpose(source).convert("RGBA")
            background = Image.new("RGBA", image.size, "white")
            background.alpha_composite(image)
            image = background.convert("RGB")
    image.thumbnail((2048, 2048))
    output = BytesIO()
    image.save(output, format="PNG")  # No EXIF, filename, embedded PDF text or attachments.
    return output.getvalue()


if __name__ == "__main__":
    try:
        if sys.platform != "win32":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (768*1024*1024, 768*1024*1024))
            resource.setrlimit(resource.RLIMIT_CPU, (25, 25))
        sys.stdout.buffer.write(rasterize(sys.stdin.buffer.read(MAX_FILE+1), sys.argv[1], int(sys.argv[2])))
    except Exception:
        sys.exit(2)
