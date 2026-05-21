import os

from flask import Flask
from flask_cors import CORS

from app.extensions import db, jwt
from app.models import Setting, User


def create_app(config=None):
    app = Flask(__name__)

    if config is None:
        app.config.from_object('config.DevelopmentConfig')
    elif isinstance(config, str):
        app.config.from_object(config)
    else:
        app.config.from_mapping(config)

    CORS(app)

    db.init_app(app)
    jwt.init_app(app)

    from app.api.images import images_bp
    from app.api.auth import auth_bp
    from app.api.convert import convert_bp
    from app.api.admin import admin_bp

    app.register_blueprint(images_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(convert_bp)
    app.register_blueprint(admin_bp)

    with app.app_context():
        db.create_all()
        _seed_defaults(app)

    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    return app


def _seed_defaults(app):
    if User.query.count() == 0:
        admin = User(username='admin', is_admin=True)
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()

    defaults = {
        'max_upload_size_mb': '16',
        'allowed_formats': 'jpg,jpeg,png,gif,webp,bmp',
        'storage_path': 'uploads',
    }
    for key, value in defaults.items():
        if Setting.query.get(key) is None:
            db.session.add(Setting(key=key, value=value))
    db.session.commit()
