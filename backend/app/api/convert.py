import io
import os
import uuid

from PIL import Image
from flask import Blueprint, current_app, jsonify, request

from app.utils import ALLOWED_EXTENSIONS, allowed_file, safe_filename

convert_bp = Blueprint('convert', __name__)


@convert_bp.route('/api/convert/<filename>', methods=['POST'])
def convert_image(filename):
    safe = safe_filename(filename)
    if safe is None:
        return jsonify({'error': '无效的文件名'}), 400
    if not allowed_file(safe):
        return jsonify({'error': '不支持的文件格式'}), 400

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], safe)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供转换参数'}), 400

    target_format = data.get('target_format', '').lower().strip()
    if target_format not in ALLOWED_EXTENSIONS:
        return jsonify({'error': f'不支持的目标格式: {target_format}'}), 400

    quality = data.get('quality', 85)
    if not isinstance(quality, int) or quality < 1 or quality > 100:
        quality = 85

    original_size = os.path.getsize(filepath)

    try:
        img = Image.open(filepath)
    except Exception:
        return jsonify({'error': '无法读取原始图片'}), 400

    is_gif = getattr(img, 'is_animated', False)
    if is_gif:
        img.seek(0)

    if target_format in ('jpg', 'jpeg'):
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGBA', img.size, (255, 255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            img = Image.alpha_composite(background, img)
        img = img.convert('RGB')

    save_format = 'JPEG' if target_format in ('jpg', 'jpeg') else target_format.upper()
    if save_format == 'BMP':
        save_format = 'BMP'

    ext = 'jpg' if target_format == 'jpeg' else target_format
    new_name = f"{uuid.uuid4().hex}.{ext}"
    new_path = os.path.join(current_app.config['UPLOAD_FOLDER'], new_name)

    save_kwargs = {'format': save_format}
    if save_format in ('JPEG', 'WEBP'):
        save_kwargs['quality'] = quality
    if save_format == 'PNG':
        save_kwargs['optimize'] = True

    img.save(new_path, **save_kwargs)
    converted_size = os.path.getsize(new_path)

    return jsonify({
        'success': True,
        'filename': new_name,
        'url': f'/uploads/{new_name}',
        'original_filename': filename,
        'original_size': original_size,
        'converted_size': converted_size,
        'format': ext,
    })
