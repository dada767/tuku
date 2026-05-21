import os
from datetime import datetime
from functools import wraps

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, verify_jwt_in_request

from app.extensions import db
from app.models import Setting, User
from app.utils import allowed_file, safe_filename

admin_bp = Blueprint('admin', __name__)


def format_size(size_bytes):
    if size_bytes < 1024:
        return f'{size_bytes} B'
    elif size_bytes < 1024 * 1024:
        return f'{size_bytes / 1024:.1f} KB'
    elif size_bytes < 1024 * 1024 * 1024:
        return f'{size_bytes / (1024 * 1024):.1f} MB'
    else:
        return f'{size_bytes / (1024 * 1024 * 1024):.2f} GB'


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        verify_jwt_in_request()
        claims = get_jwt()
        if not claims.get('is_admin'):
            return jsonify({'error': '需要管理员权限'}), 403
        return f(*args, **kwargs)
    return decorated


@admin_bp.route('/api/admin/stats', methods=['GET'])
@admin_required
def stats():
    upload_dir = current_app.config['UPLOAD_FOLDER']
    total_images = 0
    total_storage = 0
    format_breakdown = {}
    images_meta = []

    for filename in os.listdir(upload_dir):
        filepath = os.path.join(upload_dir, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            stat = os.stat(filepath)
            total_images += 1
            total_storage += stat.st_size
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else 'unknown'
            format_breakdown[ext] = format_breakdown.get(ext, 0) + 1
            images_meta.append({
                'filename': filename,
                'url': f'/uploads/{filename}',
                'size': stat.st_size,
                'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    images_meta.sort(key=lambda x: x['uploaded_at'], reverse=True)
    recent_uploads = images_meta[:10]

    total_users = User.query.count()

    return jsonify({
        'total_images': total_images,
        'total_users': total_users,
        'total_storage_bytes': total_storage,
        'total_storage_formatted': format_size(total_storage),
        'recent_uploads': recent_uploads,
        'format_breakdown': format_breakdown,
    })


@admin_bp.route('/api/admin/users', methods=['GET'])
@admin_required
def list_users():
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([u.to_dict() for u in users])


@admin_bp.route('/api/admin/users', methods=['POST'])
@admin_required
def create_user():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供用户数据'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码长度不能少于6位'}), 400

    existing = User.query.filter_by(username=username).first()
    if existing:
        return jsonify({'error': '用户名已存在'}), 400

    user = User(username=username)
    user.set_password(password)
    user.is_admin = bool(data.get('is_admin', False))

    db.session.add(user)
    db.session.commit()

    return jsonify(user.to_dict()), 201


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    user = User.query.get(user_id)
    if user is None:
        return jsonify({'error': '用户不存在'}), 404

    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供更新数据'}), 400

    if 'username' in data:
        new_username = data['username'].strip()
        if not new_username:
            return jsonify({'error': '用户名不能为空'}), 400
        existing = User.query.filter(User.username == new_username, User.id != user_id).first()
        if existing:
            return jsonify({'error': '用户名已存在'}), 400
        user.username = new_username

    if 'password' in data and data['password']:
        if len(data['password']) < 6:
            return jsonify({'error': '密码长度不能少于6位'}), 400
        user.set_password(data['password'])

    if 'is_admin' in data:
        user.is_admin = bool(data['is_admin'])

    db.session.commit()
    return jsonify(user.to_dict())


@admin_bp.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    current_user_id = int(get_jwt_identity())
    if user_id == current_user_id:
        return jsonify({'error': '不能删除自己的账号'}), 400

    user = User.query.get(user_id)
    if user is None:
        return jsonify({'error': '用户不存在'}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({'success': True})


@admin_bp.route('/api/admin/images', methods=['GET'])
@admin_required
def list_admin_images():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    fmt_filter = request.args.get('format', '').lower().strip()

    upload_dir = current_app.config['UPLOAD_FOLDER']
    all_images = []
    for filename in os.listdir(upload_dir):
        filepath = os.path.join(upload_dir, filename)
        if os.path.isfile(filepath) and allowed_file(filename):
            ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
            if fmt_filter and ext != fmt_filter:
                continue
            stat = os.stat(filepath)
            all_images.append({
                'filename': filename,
                'url': f'/uploads/{filename}',
                'size': stat.st_size,
                'size_formatted': format_size(stat.st_size),
                'format': ext,
                'uploaded_at': datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    all_images.sort(key=lambda x: x['uploaded_at'], reverse=True)
    total = len(all_images)
    total_pages = max(1, (total + per_page - 1) // per_page)
    start = (page - 1) * per_page
    end = start + per_page
    paged = all_images[start:end]

    return jsonify({
        'images': paged,
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    })


@admin_bp.route('/api/admin/images/batch-delete', methods=['POST'])
@admin_required
def batch_delete_images():
    data = request.get_json(silent=True)
    if not data or 'filenames' not in data:
        return jsonify({'error': '请提供要删除的文件名列表'}), 400

    filenames = data['filenames']
    if not isinstance(filenames, list):
        return jsonify({'error': 'filenames 必须是数组'}), 400

    upload_dir = current_app.config['UPLOAD_FOLDER']
    deleted = 0
    errors = []

    for filename in filenames:
        safe = safe_filename(filename)
        if safe is None:
            errors.append(f'{filename}: 无效的文件名')
            continue
        if not allowed_file(safe):
            errors.append(f'{filename}: 不支持的文件格式')
            continue
        filepath = os.path.join(upload_dir, safe)
        if not os.path.exists(filepath):
            errors.append(f'{filename}: 文件不存在')
            continue
        try:
            os.remove(filepath)
            deleted += 1
        except OSError as e:
            errors.append(f'{filename}: {str(e)}')

    return jsonify({'deleted_count': deleted, 'errors': errors})


@admin_bp.route('/api/admin/settings', methods=['GET'])
@admin_required
def get_settings():
    settings = Setting.query.all()
    result = {}
    for s in settings:
        result[s.key] = s.value
    return jsonify(result)


ALLOWED_SETTING_KEYS = {'max_upload_size_mb', 'allowed_formats', 'storage_path'}


@admin_bp.route('/api/admin/settings', methods=['PUT'])
@admin_required
def update_settings():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供设置数据'}), 400

    for key, value in data.items():
        if key not in ALLOWED_SETTING_KEYS:
            return jsonify({'error': f'未知的设置项: {key}'}), 400
        setting = Setting.query.get(key)
        if setting:
            setting.value = str(value)
        else:
            db.session.add(Setting(key=key, value=str(value)))

    db.session.commit()
    return jsonify({'success': True})
