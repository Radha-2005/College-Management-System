// require('dotenv').config();
// const { OpenAI } = require('openai');

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'viit_secret_2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60 * 60 * 1000 }
}));

// DB
const db = new sqlite3.Database('viit.db', err => {
  if (err) console.error('DB connection error:', err);
  else console.log('Connected to viit.db');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL,
    department TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    prn TEXT UNIQUE NOT NULL,
    division TEXT NOT NULL,
    roll_no INTEGER NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS lecturers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    employee_id TEXT UNIQUE NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    division TEXT NOT NULL,
    lecturer_id INTEGER,
    FOREIGN KEY(lecturer_id) REFERENCES lecturers(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER,
    subject_id INTEGER,
    date TEXT,
    status TEXT,
    FOREIGN KEY(student_id) REFERENCES students(id),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS syllabus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER,
  unit TEXT,
  content TEXT,
  FOREIGN KEY(subject_id) REFERENCES subjects(id)
)`);
});

// Auth Middleware
function requireRole(role) {
  return (req, res, next) => {
    if (!req.session.user || req.session.user.role !== role) {
      console.log(`Access denied: expected ${role}, got ${req.session.user?.role}`);
      return res.redirect(`/${role}-login`);
    }
    next();
  };
}

// Register
app.post('/register/:role', async (req, res) => {
  const { email, password } = req.body;
  const role = req.params.role;
  const extra = role === 'student' ? req.body : { employee_id: req.body.employee_id };
  try {
    const hashed = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (email, password, role, department) VALUES (?, ?, ?, ?)',
      [email, hashed, role, 'AIDS'], function (err) {
        if (err) {
          console.error('Register error (users):', err.message);
          return res.json({ error: err.message });
        }
        const userId = this.lastID;
        if (role === 'student') {
          db.run('INSERT INTO students (user_id, prn, division, roll_no) VALUES (?, ?, ?, ?)',
            [userId, extra.prn, extra.division, extra.roll_no], e => {
              if (e) console.error('Register error (students):', e.message);
              res.json(e ? { error: e.message } : { message: 'Registered' });
            });
        } else {
          db.run('INSERT INTO lecturers (user_id, employee_id) VALUES (?, ?)',
            [userId, extra.employee_id], e => {
              if (e) console.error('Register error (lecturers):', e.message);
              res.json(e ? { error: e.message } : { message: 'Registered' });
            });
        }
      });
  } catch (e) {
    console.error('Register server error:', e);
    res.json({ error: 'Server error' });
  }
});

// Login
app.post('/login', (req, res) => {
  const { email, password, role } = req.body;
  console.log('Login attempt:', { email, role });
  db.get('SELECT * FROM users WHERE email = ? AND role = ?', [email, role], async (err, user) => {
    if (err) {
      console.error('Login DB error:', err);
      return res.json({ error: 'Database error' });
    }
    if (!user) {
      console.log('User not found');
      return res.json({ error: 'Invalid email or role' });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Wrong password');
      return res.json({ error: 'Wrong password' });
    }
    req.session.user = { id: user.id, role };
    console.log('Login SUCCESS →', req.session.user);
    res.json({ redirect: `/${role}-dashboard` });
  });
});

app.get('/logout', (req, res) => {
  console.log('User logged out');
  req.session.destroy();
  res.redirect('/');
});

// LECTURER: Add Subject
app.post('/lecturer/subject', requireRole('lecturer'), (req, res) => {
  const { name, division } = req.body;
  console.log('Add subject request:', { name, division, userId: req.session.user.id });

  if (!name || !division) {
    console.log('Validation failed: missing name or division');
    return res.status(400).json({ error: 'Name and division required' });
  }

  db.get('SELECT id FROM lecturers WHERE user_id = ?', [req.session.user.id], (err, lec) => {
    if (err || !lec) {
      console.error('Lecturer not found:', err);
      return res.status(404).json({ error: 'Lecturer not found' });
    }

    db.run('INSERT INTO subjects (name, division, lecturer_id) VALUES (?, ?, ?)',
      [name, division, lec.id], function (err) {
        if (err) {
          console.error('Subject insert error:', err.message);
          return res.status(500).json({ error: err.message });
        }
        console.log('Subject added, ID:', this.lastID);
        res.json({ message: 'Subject added successfully' });
      });
  });
});

// LECTURER: Get Subjects
app.get('/lecturer/subjects', requireRole('lecturer'), (req, res) => {
  db.get('SELECT id FROM lecturers WHERE user_id = ?', [req.session.user.id], (e, lec) => {
    if (e || !lec) return res.json([]);
    db.all('SELECT id, name, division FROM subjects WHERE lecturer_id = ? ORDER BY name', [lec.id], (e, rows) => {
      res.json(e ? [] : rows);
    });
  });
});

// LECTURER: Get Divisions for Subject
app.get('/lecturer/subject/:id/divisions', requireRole('lecturer'), (req, res) => {
  const { id } = req.params;
  db.all('SELECT DISTINCT division FROM subjects WHERE name = (SELECT name FROM subjects WHERE id = ?)', [id], (e, rows) => {
    res.json(e ? [] : rows.map(r => r.division));
  });
});

// LECTURER: Get Students by Division
app.get('/lecturer/division/:div/students', requireRole('lecturer'), (req, res) => {
  const { div } = req.params;
  db.all(`
    SELECT s.id, s.prn, s.roll_no, u.email
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.division = ?
    ORDER BY s.roll_no ASC
  `, [div], (e, rows) => res.json(e ? [] : rows));
});

// LECTURER: Mark Attendance
app.post('/lecturer/attendance', requireRole('lecturer'), (req, res) => {
  const { subject_id, date, present_students } = req.body;
  if (!date || !present_students.length) {
    return res.status(400).json({ error: 'Date and students required' });
  }
  const stmt = db.prepare('INSERT INTO attendance (student_id, subject_id, date, status) VALUES (?, ?, ?, ?)');
  present_students.forEach(id => stmt.run(id, subject_id, date, 'present'));
  stmt.finalize(err => {
    if (err) console.error('Attendance insert error:', err);
    res.json({ message: 'Attendance marked' });
  });
});

// STUDENT: Get Attendance
app.get('/student/attendance', requireRole('student'), (req, res) => {
  db.get('SELECT id FROM students WHERE user_id = ?', [req.session.user.id], (e, stu) => {
    if (e || !stu) return res.json([]);
    db.all(`
      SELECT sub.name AS subject, att.date, att.status
      FROM attendance att
      JOIN subjects sub ON att.subject_id = sub.id
      WHERE att.student_id = ?
      ORDER BY att.date DESC
    `, [stu.id], (e, rows) => res.json(e ? [] : rows));
  });
});


// --- SYLLABUS ---
app.post('/lecturer/syllabus', requireRole('lecturer'), (req, res) => {
  const { subject_id, unit, content } = req.body;
  db.run('INSERT INTO syllabus (subject_id, unit, content) VALUES (?, ?, ?)',
    [subject_id, unit, content], e => res.json(e ? { error: e.message } : { message: 'Added' }));
});

app.get('/lecturer/syllabus/:subjectId', requireRole('lecturer'), (req, res) => {
  db.all('SELECT * FROM syllabus WHERE subject_id = ? ORDER BY unit', [req.params.subjectId], (e, rows) => res.json(e ? [] : rows));
});

app.get('/student/syllabus', requireRole('student'), (req, res) => {
  db.get('SELECT division FROM students WHERE user_id = ?', [req.session.user.id], (err, student) => {
    if (err || !student) return res.json([]);
    
    db.all(`
      SELECT sub.id AS subject_id, sub.name, syl.unit, syl.content
      FROM syllabus syl
      JOIN subjects sub ON syl.subject_id = sub.id
      WHERE sub.division = ?
      ORDER BY sub.name, syl.unit
    `, [student.division], (err, rows) => {
      res.json(err ? [] : rows);
    });
  });
});

// --- MEETINGS ---
app.post('/student/meeting', requireRole('student'), (req, res) => {
  const { lecturer_id, reason } = req.body;
  db.get('SELECT id FROM students WHERE user_id = ?', [req.session.user.id], (e, s) => {
    db.run('INSERT INTO meetings (student_id, lecturer_id, reason) VALUES (?, ?, ?)',
      [s.id, lecturer_id, reason], e => res.json(e ? { error: e.message } : { message: 'Sent' }));
  });
});

app.get('/lecturer/meetings', requireRole('lecturer'), (req, res) => {
  db.get('SELECT id FROM lecturers WHERE user_id = ?', [req.session.user.id], (e, l) => {
    db.all('SELECT m.*, s.prn FROM meetings m JOIN students s ON m.student_id = s.id WHERE lecturer_id = ?', [l.id], (e, rows) => res.json(e ? [] : rows));
  });
});

app.put('/lecturer/meeting/:id', requireRole('lecturer'), (req, res) => {
  const { status, date_time } = req.body;
  db.run('UPDATE meetings SET status = ?, date_time = ? WHERE id = ?', [status, date_time || null, req.params.id], e => {
    res.json(e ? { error: e.message } : { message: 'Updated' });
  });
});

app.get('/student/meetings', requireRole('student'), (req, res) => {
  db.get('SELECT id FROM students WHERE user_id = ?', [req.session.user.id], (e, s) => {
    db.all('SELECT m.*, u.email AS lecturer_email FROM meetings m JOIN lecturers l ON m.lecturer_id = l.id JOIN users u ON l.user_id = u.id WHERE student_id = ?', [s.id], (e, rows) => res.json(e ? [] : rows));
  });
});

app.get('/student/lecturers', requireRole('student'), (req, res) => {
  db.all('SELECT l.id, u.email FROM lecturers l JOIN users u ON l.user_id = u.id', (e, rows) => res.json(e ? [] : rows));
});

// app.post('/generate-quiz', requireRole('student'), async (req, res) => {
//   const { topic } = req.body;
//   try {
//     const completion = await openai.chat.completions.create({
//       model: 'gpt-3.5-turbo',
//       messages: [
//         { role: 'system', content: 'You are a quiz generator. Create 5 multiple-choice questions with 4 options (A-D). Mark the correct answer with [Correct].' },
//         { role: 'user', content: `Generate quiz from this content:\n\n${topic}` }
//       ],
//       max_tokens: 1000,
//       temperature: 0.8
//     });
//     res.json({ quiz: completion.choices[0].message.content });
//   } catch (error) {
//     console.error('OpenAI Error:', error.message);
//     res.status(500).json({ error: 'Quiz generation failed. Check API key or model.' });
//   }
// });

// HTML Pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/student-register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'student-register.html')));
app.get('/student-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'student-login.html')));
app.get('/lecturer-register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lecturer-register.html')));
app.get('/lecturer-login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'lecturer-login.html')));
app.get('/student-dashboard', requireRole('student'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'student-dashboard.html')));
app.get('/lecturer-dashboard', requireRole('lecturer'), (req, res) => res.sendFile(path.join(__dirname, 'public', 'lecturer-dashboard.html')));

const PORT = process.env.PORT || 80;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});