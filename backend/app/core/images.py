"""Shared image upload validation: magic-byte sniffing + a size cap."""

MAX_IMAGE_BYTES = 2 * 1024 * 1024

# magic-byte prefixes per allowed type, so a renamed non-image can't be stored
_IMAGE_MAGIC = {
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "image/webp": [b"RIFF"],
}


def is_valid_image(mime: str, data: bytes) -> bool:
    if mime not in _IMAGE_MAGIC:
        return False
    if mime == "image/webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return any(data.startswith(magic) for magic in _IMAGE_MAGIC[mime])
