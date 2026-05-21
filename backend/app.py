import os
import uuid
import io
from datetime import datetime

import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

app.config['UPLOAD_FOLDER'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'}

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)


def allowed_file(filename):
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_EXTENSIONS


def get_image_mime_type(filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    mime_map = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
        'png': 'image/png', 'gif': 'image/gif',
        'webp': 'image/webp', 'bmp': 'image/bmp',
    }
    return mime_map.get(ext, 'application/octet-stream')


@app.route('/api/images')
def list_images():
    images = []
    upload_dir = app.config['UPLOAD_FOLDER']
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


@app.route('/api/upload', methods=['POST'])
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
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], safe_name)
        file.save(filepath)

        stat = os.stat(filepath)
        uploaded.append({
            'filename': safe_name,
            'url': f'/uploads/{safe_name}',
            'size': stat.st_size,
            'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })

    return jsonify(uploaded), 201


@app.route('/api/images/<filename>', methods=['DELETE'])
def delete_image(filename):
    if not allowed_file(filename):
        return jsonify({'error': '不支持的文件格式'}), 400

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    if not os.path.exists(filepath):
        return jsonify({'error': '文件不存在'}), 404

    os.remove(filepath)
    return jsonify({'success': True})


@app.route('/uploads/<filename>')
def serve_upload(filename):
    return send_from_directory(
        app.config['UPLOAD_FOLDER'], filename,
        mimetype=get_image_mime_type(filename)
    )


@app.route('/api/inpaint/<filename>', methods=['POST'])
def inpaint_image(filename):
    if not allowed_file(filename):
        return jsonify({'error': '不支持的文件格式'}), 400

    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
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
    result_path = os.path.join(app.config['UPLOAD_FOLDER'], result_name)
    _, buf = cv2.imencode('.png', result)
    with open(result_path, 'wb') as f:
        f.write(buf.tobytes())

    return jsonify({
        'success': True,
        'filename': result_name,
        'url': f'/uploads/{result_name}',
    })


@app.route('/api/save-edited/<filename>', methods=['POST'])
def save_edited(filename):
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
        if not allowed_file(filename):
            return jsonify({'error': '不支持的文件格式'}), 400
        saved_name = filename
    else:
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'png'
        saved_name = f"{uuid.uuid4().hex}.{ext}"

    save_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_name)
    with open(save_path, 'wb') as f:
        f.write(image_bytes)

    return jsonify({
        'success': True,
        'filename': saved_name,
        'url': f'/uploads/{saved_name}',
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
