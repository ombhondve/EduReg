from flask import Flask, Response, jsonify, render_template, request
import bcrypt, datetime

def check_hash_pass(data,stor_data):
    password = data
    user=stor_data
    chk_hash_pass=bcrypt.checkpw(password.encode('utf-8'), user.encode('utf-8'))
    if chk_hash_pass is True:
        return True
    else:
        return False




def hash_pass(data):
    password = data
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    return hashed_password
