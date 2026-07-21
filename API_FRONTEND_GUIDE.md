# How to connect your REST APIs to the frontend

The frontend talks to your backend through this file:

```text
static/js/api-client.js
```

Most of the time, you only need to edit `StudentApi` in that file.

## Current API connection

```js
const API_BASE = window.API_BASE || '/api';
```

Keep `/api` when Flask serves both the frontend and backend from this same project.

If your API runs on another port, change it like this:

```js
const API_BASE = 'http://localhost:5000/api';
```

## Add a new GET API

Backend example:

```python
@app.route('/api/teachers', methods=['GET'])
def list_teachers():
    return jsonify([])
```

Frontend example in `api-client.js`:

```js
getTeachers() {
  return requestApi('/teachers');
}
```

Use it in `script.js`:

```js
const teachers = await StudentApi.getTeachers();
```

## Add a new POST API

Backend example:

```python
@app.route('/api/teachers', methods=['POST'])
def create_teacher():
    data = request.get_json()
    return jsonify(data), 201
```

Frontend example in `api-client.js`:

```js
createTeacher(teacherData) {
  return requestApi('/teachers', {
    method: 'POST',
    body: JSON.stringify(teacherData),
  });
}
```

Use it in `script.js`:

```js
await StudentApi.createTeacher({
  name: 'Amit',
  subject: 'Math',
});
```

## Files you usually edit

- `server.py`: create your Flask REST API routes.
- `database.py`: database connection, tables, and helper functions.
- `static/js/api-client.js`: one function per backend API.
- `static/js/script.js`: show API data in the page.

## Run the app

```bat
run.bat
```

Then open:

```text
http://localhost:3000
```
