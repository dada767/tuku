import os

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'}


def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def safe_filename(filename):
    """Strip path components to prevent directory traversal."""
    safe = os.path.basename(filename)
    if safe != filename:
        return None
    return safe


def get_image_mime_type(filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'bmp': 'image/bmp',
    }
    return mime_map.get(ext, 'application/octet-stream')
