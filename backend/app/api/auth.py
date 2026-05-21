from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required

from app.extensions import db
from app.models import User

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供用户名和密码'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400

    user = User.query.filter_by(username=username).first()
    if user is None or not user.check_password(password):
        return jsonify({'error': '用户名或密码错误'}), 401

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'username': user.username, 'is_admin': user.is_admin},
    )
    return jsonify({'access_token': access_token, 'user': user.to_dict()})


@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': '请提供用户名和密码'}), 400

    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': '用户名和密码不能为空'}), 400
    if len(username) < 2:
        return jsonify({'error': '用户名至少2个字符'}), 400
    if len(password) < 6:
        return jsonify({'error': '密码长度不能少于6位'}), 400

    existing = User.query.filter_by(username=username).first()
    if existing:
        return jsonify({'error': '用户名已存在'}), 400

    user = User(username=username, is_admin=False)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(
        identity=str(user.id),
        additional_claims={'username': user.username, 'is_admin': user.is_admin},
    )
    return jsonify({'access_token': access_token, 'user': user.to_dict()}), 201


@auth_bp.route('/api/auth/me', methods=['GET'])
@jwt_required()
def me():
    user_id = get_jwt_identity()
    user = User.query.get(int(user_id))
    if user is None:
        return jsonify({'error': '用户不存在'}), 404
    return jsonify(user.to_dict())
