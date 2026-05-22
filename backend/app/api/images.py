import io
import os
import uuid
from datetime import datetime

import cv2
import numpy as np
from PIL import Image
from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import jwt_required

from app.utils import allowed_file, get_image_mime_type, safe_filename

images_bp = Blueprint('images', __name__)


@images_bp.route('/api/images')
@jwt_required()
def list_images():
    images = []
    upload_dir = current_app.config['UPLOAD_FOLDER']
    for filename in os.listdir(upload_dir):
        filepath = os.path.join(upload_dir, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            stat = os.stat(filepath)
            images.append({
                'filename': filename,
                'url': f'/uploads/{filename}',
                'size': stat.st_size,
                'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })
    images.sort(key=lambda x: x['uploaded_at'], reverse=True)
    return jsonify(images)


@images_bp.route('/api/upload', methods=['POST'])
@jwt_required()
def upload():
    if 'images' not in request.files:
        return jsonify({'error': '没有找到上传的文件'}), 400

    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({'error': '没有选择任何文件'}), 400

    uploaded = []
    for file in files:
        if not file.filename:
            continue
        if not allowed_file(file.filename):
            return jsonify({'error': f'不支持的文件格式: {file.filename}'}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        safe_name = f"{uuid.uuid4().hex}{uuid.uuid4().hex[:8]}.{ext}"
        filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], safe_name)
        file.save(filepath)

        stat = os.stat(filepath)
        uploaded.append({
            'filename': safe_name,
            'url': f'/uploads/{safe_name}',
            'size': stat.st_size,
            'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })

    return jsonify(uploaded), 201


@images_bp.route('/api/images/<filename>', methods=['DELETE'])
@jwt_required()
def delete_image(filename):
    safe = safe_filename(filename)
    if safe is None:
        return jsonify({'error': '无效的文件名'}), 400
    if not allowed_file(safe):
        return jsonify({'error': '不支持的文件格式'}), 400

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], safe)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404

    os.remove(filepath)
    return jsonify({'success': True})


@images_bp.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(
        current_app.config['UPLOAD_FOLDER'], filename,
        mimetype=get_image_mime_type(filename)
    )


@images_bp.route('/api/inpaint/<filename>', methods=['POST'])
@jwt_required()
def inpaint_image(filename):
    safe = safe_filename(filename)
    if safe is None:
        return jsonify({'error': '无效的文件名'}), 400
    if not allowed_file(safe):
        return jsonify({'error': '不支持的文件格式'}), 400

    filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], safe)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404

    if 'mask' not in request.files:
        return jsonify({'error': '缺少mask文件'}), 400

    with open(filepath, 'rb') as f:
        image_bytes = f.read()
    original = cv2.imdecode(np.frombuffer(image_bytes, np.uint8), cv2.IMREAD_COLOR)
    if original is None:
        return jsonify({'error': '无法读取原始图片'}), 400

    mask_file = request.files['mask']
    mask_bytes = mask_file.read()
    mask_array = np.frombuffer(mask_bytes, np.uint8)
    mask = cv2.imdecode(mask_array, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return jsonify({'error': '无法解析mask文件'}), 400

    _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

    radius = request.form.get('radius', 3, type=int)

    result = cv2.inpaint(original, mask, radius, cv2.INPAINT_TELEA)

    result_name = f"inpaint_{uuid.uuid4().hex}.png"
    result_path = os.path.join(current_app.config['UPLOAD_FOLDER'], result_name)
    _, buf = cv2.imencode('.png', result)
    with open(result_path, 'wb') as f:
        f.write(buf.tobytes())

    return jsonify({
        'success': True,
        'filename': result_name,
        'url': f'/uploads/{result_name}',
    })


@images_bp.route('/api/save-edited/<filename>', methods=['POST'])
@jwt_required()
def save_edited(filename):
    safe = safe_filename(filename)
    if safe is None:
        return jsonify({'error': '无效的文件名'}), 400

    if 'image' not in request.files:
        return jsonify({'error': '缺少image文件'}), 400

    action = request.form.get('action', '')
    if action not in ('copy', 'overwrite'):
        return jsonify({'error': '无效的操作类型，必须是 copy 或 overwrite'}), 400

    image_file = request.files['image']
    image_bytes = image_file.read()

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.verify()
    except Exception:
        return jsonify({'error': '上传的文件不是有效的图片'}), 400

    if action == 'overwrite':
        if not allowed_file(safe):
            return jsonify({'error': '不支持的文件格式'}), 400
        saved_name = safe
    else:
        ext = safe.rsplit('.', 1)[1].lower() if '.' in safe else 'png'
        saved_name = f"{uuid.uuid4().hex}.{ext}"

    save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], saved_name)
    with open(save_path, 'wb') as f:
        f.write(image_bytes)

    return jsonify({
        'success': True,
        'filename': saved_name,
        'url': f'/uploads/{saved_name}',
    })
